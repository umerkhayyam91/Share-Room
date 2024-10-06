// const multer = require('multer');

// // Set up storage for uploaded files
// const storage = multer.diskStorage({
//   destination: function (req, file, cb) {
//     cb(null, 'uploads/'); // Specify the destination folder where files will be stored
//   },
//   filename: function (req, file, cb) {
//     // Generate a unique filename for the uploaded file
//     const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
//     cb(null, file.fieldname + '-' + uniqueSuffix + '-' + file.originalname);
//   }
// });

// // Create the multer middleware with the defined storage configuration
// const upload = multer({ storage: storage });

// module.exports = upload;
