const express = require("express");
const router = express.Router();
const User = require("../models/users");
const multer = require("multer");
const fs = require("fs");
const Revision = require('../models/revision');
const { v4: uuidv4 } = require("uuid");
const validator = require("validator");
const bcrypt = require("bcryptjs");
const moment = require("moment");
const cron = require("node-cron");
const nodemailer = require("nodemailer");


router.get("/", (req, res) => {
    res.render("register");
});

router.get("/login", (req, res) => {
    res.render("login");
});

router.get("/dashboard", (req, res) => {
    res.render("dashboard");
});

// registration api starts
router.post("/register", async (req, res) => {

    const name = req.body.name
    const email = req.body.email
    const password = req.body.password
    const token = uuidv4();

    const errors = [];

    if (!name) {
        errors.push("Please enter a name");
    }
    if (!email) {
        errors.push("Please enter an email");
    }
    if (!password) {
        errors.push("Please enter a password");
    }
    if (!validator.isEmail(email)) {
        errors.push("Please enter a valid email");
    }
    if (password.length < 8) {
        errors.push("Password should be atleast 8 characters long");
    }

    if (errors.length > 0) {
        res.status(400).json({ errors })
    } else {
        try {
            const hashedPassword = await bcrypt.hash(password, 8);
            const user = new User({
                name,
                email,
                hashedPassword,
                token,
            });
            const savedUser = await user.save();

            if (!savedUser) {
                res.status(500).send({ message: "Error occured" });
            } else {
                res.status(200).send({ message: "Successful" });
            }
        } catch (error) {
            if (error.code === 11000 && error.keyPattern && error.keyPattern.email === 1) {
                res.status(409).json({ message: "Email is already in use, please enter a unique email" }); // Use 409 Conflict
            } else {
                res.status(500).json({ message: "Error in catch" }); // Use 500 Internal Server Error
            }
        }
    }
});

// ends


router.post("/login", async (req, res) => {
    const email = req.body.email;
    const password = req.body.password;

    const errors = [];

    if (!email) {
        errors.push("Please provide the email");
    }
    if (!password) {
        errors.push("Please provide the password");
    }

    if (errors.length > 0) {
        res.status(400).json({ errors });
        return;
    }
    const user = await User.findOne({ email });

    if (!user) {
        errors.push("This email is not registered");
        res.status(400).json({ errors });
        return;
    } else {
        const checkPassword = await bcrypt.compare(password, user.hashedPassword);

        if (!checkPassword) {
            errors.push("Wrong password");
            res.status(400).json({ errors });
            return;
        } else {
            const username = user.name;
            const userEmail = user.email;
            res.status(201).send({ userEmail, username, message: "Logged in" });
        }
    }

});

router.post('/submit-progress', async (req, res) => {
    const { pagesRead, fromPageToPage, difficulty, email } = req.body;
    const token = uuidv4();
    const today = moment();

    const reminderDate = today.add(difficulty, 'weeks').format("DD-MM-YYYY");

    const revision = new Revision({
        pagesRead,
        fromPageToPage,
        difficulty,
        email,
        token: token,
        reminder: reminderDate,
    });

    const newRevision = await revision.save();

    if (newRevision) {
        res.status(200).json({ message: "Revision has been saved" });
    } else {
        res.status(400).json({ message: "Unexpected Error Occured" });
    };
});


router.get('/get-revisions', async (req, res) => {
    try {
        const email = req.query.email;
        // console.log("Here");

        if (!email) {
            // console.log("this issue");
            return res.status(400).send({ error: 'Email is required' });
        }

        // Query the database for revisions associated with the provided deviceID
        const revisions = await Revision.find({ email });

        if (revisions.length === 0) {
            return res.status(404).send({ message: 'No revisions found for this device' });
        }

        // Return the found revisions
        res.status(200).json(revisions);
    } catch (error) {
        console.error(error);
        res.status(500).send({ error: 'An error occurred while fetching revisions' });
    }
});


router.delete('/delete-revision', async (req, res) => {
    const { token } = req.body;

    try {
        await Revision.findOneAndDelete(token); // Assuming you use Mongoose
        res.status(200).json({ message: 'Revision deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting revision', error });
    }
});


const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL,
      pass: process.env.GMAILPASSWORD,
    },
  });
  
  // Function to send email
  const sendReminderEmail = async (email, reminderDate, fromPageToPage, difficulty) => {
    const mailOptions = {
      from: '"No Reply" <noreply@example.com>', // Sender address
      to: email, // Recipient email
      subject: 'Reminder Notification',
      text: `This is a reminder for your revision from page ${fromPageToPage} with the difficulty of ${difficulty} as  scheduled on ${reminderDate}.`,
    };
  
    try {
      await transporter.sendMail(mailOptions);
      console.log(`Reminder email sent to ${email}`);
    } catch (error) {
      console.error('Error sending email:', error);
    }
  };
  
  // Cron job to run every day at 11 AM
  cron.schedule('0 11 * * *', async () => {
    try {
      const today = moment().format('DD-MM-YYYY'); // Get today's date in DD-MM-YYYY format
      console.log(today);
  
      // Find all reminders for today
      const reminders = await Revision.find({ reminder: today });
  
      if (reminders.length > 0) {
        reminders.forEach(async (reminder) => {
          // Send email to the user
          await sendReminderEmail(reminder.email, reminder.reminder, reminder.fromPageToPage, reminder.difficulty);
          console.log("Email sent");
        });
      } else {
        console.log('No reminders for today.');
      }
    } catch (error) {
      console.error('Error checking reminders:', error);
    }
  }, {
    timezone: "UTC" // Ensures the cron job runs at 11 AM UTC
  });







module.exports = router;