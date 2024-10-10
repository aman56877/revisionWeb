require("dotenv").config();
const express = require('express')
const session = require("express-session");
const mongoose = require("mongoose");
const app = express()
const cors = require("cors");
const port = process.env.PORT || 4000

app.listen(port, () => console.log(`Example app listening on port http://localhost:${port}`))



// database connection
mongoose.connect(process.env.DB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
const db = mongoose.connection;
db.on('error', (error) => console.log(error));
db.once('open', () => console.log("Connected to the db"));

app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(cors());

app.use(
    session({
        secret: process.env.SECRET_KEY,
        saveUninitialized: true,
        resave: false,
    })
);


app.use(express.static('uploads'));

// to handle the message session
app.use((req, res, next)=>{
    res.locals.message = req.session.message;
    delete req.session.message;
    next();
})

app.set("view engine", "ejs")

app.use("", require("./routes/routes"));