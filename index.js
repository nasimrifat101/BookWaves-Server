const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.yuxyuxp.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const booksCollection = client.db("BookWaves").collection("books");
    const categoryCollection = client.db("BookWaves").collection("brands");
    const borrowCollection = client.db("BookWaves").collection("borrows");

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
      console.log(result);
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
        console.log(result);
      } catch (error) {
        console.error(error);
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
        console.error("Error fetching phones:", error);
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
    app.get("/borrowing", async (req, res) => {
      console.log(req.query.email);
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
