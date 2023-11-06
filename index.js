const express = require("express");
const cors = require("cors");
const jwt = require(`jsonwebtoken`);
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const app = express();
const port = process.env.PORT || 5000;

app.use(
  cors({
    origin: [`http://localhost:5173`],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.yuxyuxp.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// middlewares
const logger = (req, res, next) => {
  console.log("log: info", req.method, req.url);
  next();
};

const verifyToken = (req, res, next) => {
  const token = req.cookies?.token;
  // console.log(`token in the middleware`, token);
  if (!token) {
    return res.status(401).send({ message: "Unauthorized access" });
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (error, decoded) => {
    if (error) {
      return res.status(401).send({ message: "unauthorized access" });
    }
    req.user = decoded;
    next();
  });
};

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const booksCollection = client.db("BookWaves").collection("books");
    const categoryCollection = client.db("BookWaves").collection("brands");
    const borrowCollection = client.db("BookWaves").collection("borrows");

    // auth api
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      console.log("token for user", user);
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "2h",
      });

      res.cookie("token", token, {
        httpOnly: true,
        secure: true,
        sameSite: "none",
      });
      res.send({ success: true });
    });

    app.post("/logout", async (req, res) => {
      const user = req.body;
      console.log("loggingout user", user);
      res.clearCookie("token", { maxAge: 0 }).send({ success: true });
    });

    // rendering home card
    app.get("/brands", async (req, res) => {
      const cursor = categoryCollection.find();
      const result = await cursor.toArray();
      res.send(result);
      // console.log(result)
    });

    // Api for all books

    app.post("/books", async (req, res) => {
      const book = req.body;
      const result = await booksCollection.insertOne(book);
      res.send(result);
      // console.log(result);
    });

    // update book info
    app.put("/book/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateBook = req.body;
      const book = {
        $set: {
          image: updateBook.image,
          name: updateBook.name,
          author: updateBook.author,
          category: updateBook.category,
          quantity: updateBook.quantity,
          rating: updateBook.rating,
        },
      };
      const result = await booksCollection.updateOne(filter, book);
      res.send(result);
      // console.log(result);
    });

    // update quantity
    app.put("/book/update/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedQuantity = req.body.quantity;

      try {
        const result = await booksCollection.updateOne(filter, {
          $set: { quantity: updatedQuantity },
        });

        if (updatedQuantity === 0) {
          return res.status(400).send({ message: "Book Unavailable." });
        }

        res.send(result);
        // console.log(result);
      } catch (error) {
        // console.error(error);
        res.status(500).json({ message: "Internal server error." });
      }
    });

    app.get("/books", async (req, res) => {
      const cursor = booksCollection.find();
      const result = await cursor.toArray();
      res.send(result);
      // console.log(result)
    });

    app.get("/book/:category?", async (req, res) => {
      const { category } = req.params;
      try {
        const query = category ? { category: category } : {};
        const cursor = booksCollection.find(query);
        const result = await cursor.toArray();
        res.send(result);
      } catch (error) {
        // console.error("Error fetching phones:", error);
        res.status(500).send("Internal Server Error");
      }
    });

    app.get("/book/detail/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await booksCollection.findOne(query);
      res.send(result);
      // console.log(result)
    });

    // api for Borrow
    app.post("/borrow", async (req, res) => {
      const borrowData = req.body;
      const existingBorrow = await borrowCollection.findOne({
        "product._id": borrowData.product._id,
        email: borrowData.email,
      });
      if (existingBorrow) {
        return res
          .status(400)
          .send({ message: "User already borrowed this book." });
      }
      const result = await borrowCollection.insertOne(borrowData);
      res.send(result);
    });
    // api for email fetch
    app.get("/borrowing", logger, verifyToken, async (req, res) => {
      console.log(req.query.email);
      console.log("token owner", req.user);
      if(req.user.email !== req.query.email){
        return res.status(403).send({message: 'Forbidden access'})
      }
      let query = {};
      if (req.query?.email) {
        query = { email: req.query.email };
      }
      const result = await borrowCollection.find(query).toArray();
      res.send(result);
    });
    // api for delete
    app.delete("/borrowing/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await borrowCollection.deleteOne(query);
      res.send(result);
    });

    // api for adding book back to quatity
    app.put(`/books/inc/:productId`, async (req, res) => {
      const productId = req.params.productId;
      const result = await booksCollection.findOneAndUpdate(
        { _id: new ObjectId(productId) },
        { $inc: { quantity: 1 } },
        { returnDocument: "after" }
      );

      if (!result.value) {
        return res.status(404).send("Product not found");
      }

      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send(`Welcome to BookWaves Server`);
});

app.listen(port, () => {
  console.log(`BookWaves running at port ${port}`);
});
