const express = require("express");
require("dotenv").config();
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require(`jsonwebtoken`);
const cookieParser = require("cookie-parser");
const app = express();
const port = process.env.PORT || 5000;
jwtSecret = process.env.ACCESS_TOKEN_SECRET;

app.use(
  cors({
    origin: [
      `http://localhost:5173`,
      "https://bookwaves-c18d0.web.app",
      "https://bookwaves-c18d0.firebaseapp.com",
    ],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

// middleware
const verifyToken = (req, res, next) => {
  const token = req.cookies?.token;
  // console.log(`token in the middleware`, token);
  if (!token) {
    return res.status(401).send({ message: "Unauthorized access" });
  }
  jwt.verify(token, jwtSecret, (error, decoded) => {
    if (error) {
      return res.status(401).send({ message: "unauthorized access" });
    }
    req.user = decoded;
    next();
  });
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.yuxyuxp.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // await client.connect();

    const dbConnect = async () => {
      try {
        client.connect();
        console.log("DB Connected Successfully✅");
      } catch (error) {
        console.log(error.name, error.message);
      }
    };
    dbConnect();

    // Database Info
    const booksCollection = client.db("BookWaves").collection("books");
    const categoryCollection = client.db("BookWaves").collection("brands");
    const borrowCollection = client.db("BookWaves").collection("borrows");

    // Default Route

    app.get("/", (req, res) => {
      res.send(`Welcome to BookWaves Server`);
    });

    // Auth Related Api
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, jwtSecret, {
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
      res.clearCookie("token", { maxAge: 0 }).send({ success: true });
    });

    // Getting Brand Cards
    app.get("/brands", async (req, res) => {
      const cursor = categoryCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    // Api for all books
    app.post("/books", async (req, res) => {
      const book = req.body;
      const result = await booksCollection.insertOne(book);
      res.send(result);
    });

    // Update book info
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

    // api for delete from Books collection
    app.delete("/delete/book/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await booksCollection.deleteOne(query);
      res.send(result);
    });

    // update quantity decrees
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
      } catch (error) {
        res.status(500).json({ message: "Internal server error." });
      }
    });

    // Fetching All Books
    app.get("/books", async (req, res) => {
      const cursor = booksCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    // Fetching Books By Category
    app.get("/book/:category?", async (req, res) => {
      const { category } = req.params;
      try {
        const query = category ? { category: category } : {};
        const cursor = booksCollection.find(query);
        const result = await cursor.toArray();
        res.send(result);
      } catch (error) {
        res.status(500).send("Internal Server Error");
      }
    });

    // Getting book detail by id
    app.get("/book/detail/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await booksCollection.findOne(query);
      res.send(result);
    });

    // Adding Books in Borrow collection
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

    // For Fetching borrow data based on email query
    app.get("/borrowing", verifyToken, async (req, res) => {
      if (req.user.email !== req.query.email) {
        return res.status(403).send({ message: "Forbidden access" });
      }
      let query = {};
      if (req.query?.email) {
        query = { email: req.query.email };
      }
      const result = await borrowCollection.find(query).toArray();
      res.send(result);
    });

    // api for delete from borrow collection
    app.delete("/borrowing/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await borrowCollection.deleteOne(query);
      res.send(result);
    });

    // api for adding book back to quantity increase
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
    // await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`BookWaves running at port ${port}`);
});
