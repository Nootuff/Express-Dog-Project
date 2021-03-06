const express = require('express');
const router = express.Router();
const catchAsync = require("../utilities/catchAsync");
const Joi = require("joi");
const { isLoggedIn, validateUpload, isAuthor, hasLiked, hasDisliked, hasFavd } = require("../middleware");
const multer = require("multer");
const { storage } = require("../cloudinary"); //This imports the const "storage"  object from the index.js file in the cloudinary folder. Node automatically looks for a file named index.js in a folder which is why the index file isn't actually reffered to. 
const multerUpload = multer({ storage });
const Upload = require("../models/upload"); //Link for the upload schema in models.
const User = require("../models/user"); //Link for the user schema in models.

const datePosted = () => {
  const today = new Date();
  const dd = String(today.getDate()).padStart(2, '0');
  const mm = String(today.getMonth() + 1).padStart(2, '0'); //January is 0.
  const yyyy = today.getFullYear();
  return dd + '-' + mm + '-' + yyyy;
}

router.get("/", async (req, res) => { //Home (main index) page.
  const uploads = await Upload.find({}).populate("author");
  res.render("uploads/index.ejs", { uploads });
});

router.get("/new", isLoggedIn, function (req, res) { //Loads the new post page.
  res.render("uploads/new.ejs");
});

router.post("/", isLoggedIn, multerUpload.single('image'), validateUpload, catchAsync(async (req, res, next) => {  //Post new upload.  
  const dogNoise = ["Woof!", "Bark!", "Yelp!", "Yap!", "Arf!"]; //Possible messages for posting success flash.
  const upload = new Upload(req.body.upload);
  upload.image.url = req.file.path;
  upload.image.filename = req.file.filename;
  upload.author = req.user._id;
  upload.datePosted = datePosted();
  upload.likes.push(req.user._id); //User pushed into both likes and dislikes array to prevent author from liking their own post.
  upload.dislikes.push(req.user._id);
  const author = req.user;
  author.posts.push(upload);
  await author.save();
  await upload.save();
  req.flash("success", dogNoise[Math.floor(Math.random() * dogNoise.length)]); //Flash message will display a random dogNoise.
  res.redirect(`/uploads/${upload._id}`);
}));

router.get("/:id", catchAsync(async (req, res) => { //This loads an individual upload's data on the show page. 
  var find = req.params.id;
  const upload = await Upload.findById(find).populate({ path: "comments", populate: { path: "author" } }).populate("author"); // Populate lets you  automatically replace the specified paths in the document with document(s) from other collection(s). Eg. replacing those object IDs with the actual data they represent. The path code with the comments tells the system to populate all the comments from the comments array from the upload we're finding, then on each comment, populate that comment's author. 
  if (!upload) {
    req.flash("error", "Can't be found"); //Error handling.
    return res.redirect("/uploads");
  }
  res.render("uploads/show.ejs", { upload });
}));

router.get("/:id/edit", isLoggedIn, isAuthor, catchAsync(async (req, res) => { //Load the post edit page.
  const idHolder = req.params.id;
  const upload = await Upload.findById(idHolder);
  if (!upload) {
    req.flash("error", "Can't be found");
    return res.redirect("/uploads");
  }
  res.render("uploads/edit.ejs", { upload });
}));

router.put('/:id', isLoggedIn, isAuthor, validateUpload, catchAsync(async (req, res,) => { //This activates when the submit button is pressed on the edit.ejs page, updates that post.
  const idHolder = req.params.id;
  const upload = await Upload.findByIdAndUpdate(idHolder, { ...req.body.upload });
  req.flash("success", "Update Success!");
  res.redirect(`/uploads/${upload._id}`); //String template literal, note the backticks, reload current page. 
}));

//Like and un-like and dislike routes.  
router.put('/:id/like', isLoggedIn, hasLiked, catchAsync(async (req, res,) => { //Add to like array route
  const upload = await Upload.findByIdAndUpdate(req.params.id);
  upload.likes.push(req.user._id); //Push current user into post's like array. 
  if (upload.dislikes.includes(req.user._id)) {
    await Upload.findByIdAndUpdate(upload, { $pull: { dislikes: req.user._id } }); //If current user dislikes this post, pressing like button will pull the user from the dislikes array, retracting their dislike as they register their like. User cannot like and dislike a post at the same time.
  }
  await upload.save();
  req.flash("success", "Liked!");
  res.redirect(`/uploads/${upload._id}`);
}));

router.put('/:id/unlike', isLoggedIn, catchAsync(async (req, res,) => { //Remove like from likes array, replace unlike button with like button.
  const upload = req.params.id;
  const likedUser = req.user._id;
  await Upload.findByIdAndUpdate(upload, { $pull: { likes: likedUser } }); //Pulls current users ID out of the likes array.
  res.redirect(`/uploads/${upload}`);
}));

router.put('/:id/dislike', isLoggedIn, hasDisliked, catchAsync(async (req, res,) => { //Add user to Dislike array route.
  const upload = await Upload.findByIdAndUpdate(req.params.id);
  upload.dislikes.push(req.user._id);
  if (upload.likes.includes(req.user._id)) {
    await Upload.findByIdAndUpdate(upload, { $pull: { likes: req.user._id } }); //Remove user from likes array.
  }
  await upload.save();
  res.redirect(`/uploads/${upload._id}`);
}));

router.put('/:id/undislike', isLoggedIn, catchAsync(async (req, res,) => { //Remove user from dislikes array, replace undislike button with dislike .
  const upload = req.params.id;
  const dislikedUser = req.user._id;
  await Upload.findByIdAndUpdate(upload, { $pull: { dislikes: dislikedUser } });  //Pulls current users ID out of the dislikes array.
  res.redirect(`/uploads/${upload}`);
}));

//The fave and un-fave routes.
router.put('/:id/fav', isLoggedIn, hasFavd, catchAsync(async (req, res,) => { //Add post to user fav array route.
  const upload = await Upload.findById(req.params.id);
  const user = await User.findByIdAndUpdate(req.user._id);
  user.favourites.push(upload);
  await user.save();
  req.flash("success", "Fav'd!");
  res.redirect(`/uploads/${upload._id}`);
}));

router.put('/:id/unFav', isLoggedIn, catchAsync(async (req, res,) => { //Remove post from user fav array route.
  const user = req.user._id;
  const upload = req.params.id;
  await User.findByIdAndUpdate(user, { $pull: { favourites: upload } });
  req.flash("success", "Removed from favs.");
  res.redirect(`/uploads/${upload}`);
}));

router.delete('/:id', isLoggedIn, isAuthor, catchAsync(async (req, res) => { //Delete route to delete an upload, the associated middleware in the upload model activates too, deleting all the comments associated with it. 
  const upload = req.params.id;
  const user = await User.findById(req.user._id);
  if (user.posts.includes(upload)) {
    await User.findByIdAndUpdate(user, { $pull: { posts: upload } });
  }
  await Upload.findByIdAndDelete(upload);
  req.flash("success", "Deleted.");
  res.redirect('/uploads');
}));

module.exports = router;