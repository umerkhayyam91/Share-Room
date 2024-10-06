const express = require('express')
const app = express()
const mongoose = require('mongoose')
const MongoClient = require('mongodb').MongoClient;

const User = require('./models/User')
app.use(express.json())
require("dotenv").config();

mongoose.connect(
    "mongodb+srv://hassan:Maliq123@cluster0.5ucqgqt.mongodb.net/?retryWrites=true&w=majority",
    { useNewUrlParser: true }
).then(async (result) => {
    console.log("DB Connected!!");
    await User.createIndexes({ language: 1 });
    await User.createIndexes({ role: 1 });

}).catch((err) => {
    console.log(err);
});


// const uri = "mongodb+srv://hassan:Maliq123@cluster0.5ucqgqt.mongodb.net/?retryWrites=true&w=majority";
// const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

// async function listIndexes() {
//     try {
//         await client.connect();
//         console.log("DB Connected!!");

//         // const database = client.db("test");
//         // const collection = database.collection("posts");

//         // List all indexes on the collection
//         // const indexes = await collection.createIndex({role: 1});

//         // Log the indexes
//         // console.log("Index created");
//     } finally {
//         client.close();
//     }
// }

// listIndexes().catch(console.error);



const PORT = process.env.PORT || 3000

const user = require('./routes/userAuth');
app.use('/api/v1/userAuth', user)

const customers = require('./routes/customers');
app.use('/api/v1/customer', customers);

const admin = require('./routes/admins');
app.use('/api/v1/admin', admin);

const users = require('./routes/users');
app.use('/api/v1/user', users);

app.listen(PORT, () => {
    console.log("Server has been started")
})
