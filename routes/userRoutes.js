/*
username: Adam
email: adamwalkerlondon@gmail.com
pass: Winter01

username: EmochNoh
  email: blue.emu@hotmail.com
  pass: Jackson1

  username: Tester
  email: tester@hotmail.com
  pass: Testing01
*/

const express = require('express');
const passport = require('passport');
const router = express.Router();
const User = require("../models/user");
const catchAsync = require("../utilities/catchAsync");
const { isLoggedIn, authNewUser, existDisplayName, alreadyAUser } = require("../middleware");

const multer = require("multer");
const { storage } = require("../cloudinary"); //This imports the const "storage"  object from the index.js file in your cloudinary folder. Node automatically looks for a file named index.js in a folder which is why the index file isn't actually reffered to. 
const multerUpload = multer({ storage });
const { cloudinary } = require("../cloudinary");



router.get("/register", alreadyAUser, function (req, res) { //Renders register page
        res.render("users/register.ejs")
});

router.post("/register", multerUpload.single('profileImage'), authNewUser, existDisplayName, catchAsync(async (req, res) => { //The route that adds a new user onto the system. 
    try {
        const joinDate = () => {
            const today = new Date();
            const dd = String(today.getDate()).padStart(2, '0');
            const mm = String(today.getMonth() + 1).padStart(2, '0'); //January is 0!
            const yyyy = today.getFullYear();
            return dd + '-' + mm + '-' + yyyy;
          }
        const username = req.body.username;
        const email = req.body.email;
        const password = req.body.password;
        const displayName = req.body.displayName;
        const dateJoined = joinDate();
        const profileImage = (!req.file) ? { url: "/assets/placeholder.png", filename: "User-profile-image" } : { url: req.file.path, filename: req.file.filename };
        const newUser = new User({ username, email, displayName, profileImage, dateJoined }); //Creates a new instance of user with this data.
        const registeredUser = await User.register(newUser, password);
        console.log(registeredUser);
        req.login(registeredUser, error => { //This is another method from passport, logs in newly created user after registering. 
            if (error) return next(error); //If there's an error logging in the new user, go to the error handler, the error is passed to it I think, 
            req.flash("success", "Welcome to Untitled Dog Project");
            res.redirect("/uploads");
        })
    } catch (error) {
        req.flash("error", "Missing data")
        res.redirect("register")
    }
}));

router.get("/login", alreadyAUser, function (req, res) { //Renders login page. 
    res.render("users/login.ejs");
})

router.get("/privacyPolicy", function (req, res) { //Renders login page. 
    res.render("users/privacyPolicy.ejs");
})


router.get("/logout", function (req, res) {
    req.logout(); //.logout() is another route bought in from passport, logs the user out.
    req.flash("success", "Goodbye!");
    res.redirect("/uploads");
});

router.get("/accountPage", isLoggedIn, catchAsync(async (req, res) => { //Renders the current users' account page.    
    const user = await User.findById(req.user._id).populate("posts");
    res.render("users/accountPage.ejs", { user })
}));

router.get("/accountPage/favourites", isLoggedIn, catchAsync(async (req, res) => { //Renders the current users' account page.    
    const user = await User.findById(req.user._id).populate({ path: "favourites", populate: { path: "author" } });
    res.render("users/accountFavs.ejs", { user })
}));

router.get("/edit", isLoggedIn, catchAsync(async (req, res) => { //Render the user edit page.
    const user = await User.findById(req.user._id);
    res.render("users/editUser.ejs", { user });
}));

router.put('/updateUser', isLoggedIn, existDisplayName, catchAsync(async (req, res,) => { //This activates when the submit button is pressed on the editUser.ejs page.
    const displayName = req.body.displayName;
    const user = await User.findByIdAndUpdate(req.user._id, { displayName: displayName });
    //const user = await User.findByIdAndUpdate(req.user._id, { ...req.body.user });
    req.flash("success", "Update Success!");
    res.redirect("/users/edit")
}));

router.put('/destroyUserPic', isLoggedIn, catchAsync(async (req, res,) => {
    const user = await User.findById(req.user._id);
    await cloudinary.uploader.destroy(user.profileImage.filename);
    user.profileImage.url = "/assets/placeholder.png";
    user.profileImage.filename = "User-profile-image";
    await user.save();
    req.flash("success", "Image deleted.");
    res.redirect("/users/edit")
}));

router.put('/updateProfilePic', multerUpload.single('profileImage'), isLoggedIn, catchAsync(async (req, res,) => { //This activates when the submit button is pressed on the editUser.ejs page.
    const user = await User.findById(req.user._id);
    await cloudinary.uploader.destroy(user.profileImage.filename);
    const profileImage = { url: req.file.path, filename: req.file.filename };
    user.profileImage = profileImage;
    await user.save();
    req.flash("success", "Update Success!");
    res.redirect("/users/edit")
}));

router.get("/:id", catchAsync(async (req, res) => { //This renders the userpage.
    var find = req.params.id;
    const user = await (User.findById(find)).populate("posts");
    res.render("users/userPage.ejs", { user })
}));

router.get("/:id/favourites", catchAsync(async (req, res) => { //This renders the userpage. favs tab. 
    var find = req.params.id;
    const user = await (User.findById(find)).populate({ path: "favourites", populate: { path: "author" } });
    res.render("users/userFavs.ejs", { user })
}));

router.post("/login", alreadyAUser, passport.authenticate("local", { failureFlash: true, failureRedirect: "/users/login" }), (req, res) => {
    req.flash("success", "Welcome back " + req.user.username + "!")
    const redirectUrl = req.session.returnTo || "/uploads"; //When user logs in, either redirect them to the page held in returnTo as defined in middleware.js OR redirect them to /campgrounds. 
    delete req.session.returnTo; //We don't need the returnTo in the session after the redirect so delete just deletes it from the object, otherwise all these returnTo's would clutter up the object.
    res.redirect(redirectUrl);
})

module.exports = router;