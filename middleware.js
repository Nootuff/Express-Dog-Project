const { uploadSchema, commentSchema, userSchema } = require("./schemas.js")
const ExpressError = require("./utilities/ExpressError"); //Imports the function from ExpressError.js.
const Upload = require("./models/upload"); //Link for the upload schema in models.
const Comment = require("./models/comment");
const User = require("./models/user");

module.exports.isLoggedIn = (req, res, next) => { //All middleware have req, res and next. The module.exports is exporting this meaning it can be used in other files.
  if (!req.isAuthenticated()) { //isAuthenticated is a method bought in by passport. It detects if the currect user is logged in (Authenticated)
    req.session.returnTo = req.originalUrl //originalUrl holds the URL the user is requesting/page they want to go to when they hit the login screen. returnTo will be the url we redirect the user back to. Putting req.session before it adds the data of what they were trying to access to their session cookies.
    req.flash("error", "You must be signed in to do this.");
    return res.redirect("/users/login"); //These activate if the user does not read as logged in. You should always have a return on a redirect in an if statement. 
  }
  next();
}

//Middleware to ensure that if there is a currently logged in user, you cannot log in to a new account or register. 
module.exports.alreadyAUser = (req, res, next) => {
  if (req.isAuthenticated()) {
    req.flash("error", "You are already logged in!");
    return res.redirect(`/uploads`);
} else {
    next();
  }
}

module.exports.validateUpload = (req, res, next) => {
  const { error } = uploadSchema.validate(req.body);
  if (error) {
    const msg = error.details.map(el => el.message).join(",") //If there's more than 1 message, join them all together with a comment. 
    throw new ExpressError(msg, 400)
  } else {
    next();
  }
}

//Middleware to detect if the current user is the author of this post.
module.exports.isAuthor = async (req, res, next) => {
  const idHolder = req.params.id;
  const upload = await Upload.findById(idHolder);  //Look to see if the user whose logged in right now's Id equals (is the same as) the current post ID. 
  if (!upload.author.equals(req.user._id)) {
    req.flash("error", "You don't have permission to do this.");
    return res.redirect(`/uploads/${idHolder}`);
  }
  next(); //The next lets you move on with whatever you want to do once the function has ascertained you have permission.
}

//Middleware to detect if the current user is the author of this comment.
module.exports.isCommentAuthor = async (req, res, next) => {
  const idHolder = req.params.id;
  const commentIdHolder = req.params.commentId;
  const comment = await Comment.findById(commentIdHolder);
  if (!comment.author.equals(req.user._id)) {
    req.flash("error", "You don't have permission to do this.");
    return res.redirect(`/uploads/${idHolder}`);
  }
  next();
}

module.exports.validateComment = (req, res, next) => {
  const { error } = commentSchema.validate(req.body);
  if (error) {
    const msg = error.details.map(el => el.message).join(",")
    throw new ExpressError(msg, 400)
  } else {
    next();
  }
}

//Middleware to see if the current user has already liked this post.
module.exports.hasLiked = async (req, res, next) => {
  const idHolder = req.params.id;
  const upload = await Upload.findById(idHolder);
  if (upload.likes.includes(req.user._id)) {
    req.flash("error", "You don't have permission to do this.");
    return res.redirect(`/uploads/${idHolder}`);
  }
  next();
}

//Middleware to see if the current user has already disliked this post.
module.exports.hasDisliked = async (req, res, next) => {
  const idHolder = req.params.id;
  const upload = await Upload.findById(idHolder);
  if (upload.dislikes.includes(req.user._id)) {
    req.flash("error", "You don't have permission to do this.");
    return res.redirect(`/uploads/${idHolder}`);
  }
  next();
}

//Middleware to see if the current user has already faved this post.
module.exports.hasFavd = async (req, res, next) => {
  const idHolder = req.params.id;
  const upload = await Upload.findById(idHolder);
const user = await User.findById(req.user._id);
  if (user.favourites.includes(upload)) {
    req.flash("error", "You don't have permission to do this.");
    return res.redirect(`/uploads/${idHolder}`);
  }
  next();
}

//Middleware to check a new users account creation details.
module.exports.authNewUser = async (req, res, next) => {
  //Check if username has been taken already.
  const username = req.body.username;
  const existUsername = await User.findOne({username: username});
//Check to see if email has been taken.
  const email = req.body.email;
  const existEmail = await User.findOne({email: email});
  //Check to see if display name is taken.
  const displayName = req.body.displayName;
  const existDisplayName = await User.findOne({displayName: displayName});
  //Check if inputted passwords match.
  const password = req.body.password;
  const matchPass = req.body.matchPass;
//Regex system for checking password validity.
  const passRegex = /^(?=.*[0-9])(?=.*[A-Z])[a-zA-Z0-9!@#$%^&*]{8,30}$/;
  const passPattern = new RegExp(passRegex);
  const passCheck = passPattern.test(password);
  //Check if email is valid.
  const emailRegex = /(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])/;
  const emailPattern = new RegExp(emailRegex);
  const emailCheck = emailPattern.test(email); 
  //Error messages and trigger criteria.
  if(req.body.username.length < 4){
  req.flash("error", "Username must be at least 4 characters long");
return res.redirect(`/users/register`);
  } else if(username.includes(" ")){
    req.flash("error", "Username cannot include spaces");
    return res.redirect(`/users/register`);
  } else if (existUsername) {
    req.flash("error", "Username already in use");
    return res.redirect(`/users/register`);
   } else if (existEmail) {
    req.flash("error", "Email already in use");
    return res.redirect(`/users/register`);
   } else if (existDisplayName) {
    req.flash("error", "Display name already in use");
    return res.redirect(`/users/register`);
   } else if(displayName.length > 20){
    req.flash("error", "Display name too long");
    return res.redirect(`/users/register`);
   } else if (displayName.includes(" ")){
    req.flash("error", "Display name cannot include spaces");
    return res.redirect(`/users/register`);
   } else if(emailCheck == false){
    req.flash("error", "Please enter a valid email.");
    return res.redirect(`/users/register`);
   } else if(passCheck == false){
    req.flash("error", "Password must have 1 capital letter, 1 lowercase letter, 1 number & be at least 8 characters long with no spaces.");
    return res.redirect(`/users/register`);
   } else if(password != matchPass){
    req.flash("error", "Passwords must match");
    return res.redirect(`/users/register`);
   } else if(req.isAuthenticated()){
    req.flash("error", "You are already logged in!");
    return res.redirect(`/uploads`);
   } 
  next();
}

//Middleware that checks to see if the display name the user has chosen is already in use or does not meet certain criteria on the user edit page.
module.exports.existDisplayName = async (req, res, next) => {
  const displayName =  req.body.displayName;
  const existDisplayName = await User.findOne({displayName: displayName});
  if (existDisplayName) {
    req.flash("error", "Display name already in use");
    return res.redirect("/users/edit");
   } else if(displayName.length > 20){
    req.flash("error", "Display name too long");
    return res.redirect("/users/edit");
   } else if (displayName.includes(" ")){
    req.flash("error", "Display name cannot include spaces");
    return res.redirect("/users/edit");
   }
  next();
}
