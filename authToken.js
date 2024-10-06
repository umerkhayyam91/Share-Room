const express = require('express');
const app = express();
const jwt = require('jsonwebtoken')
require("dotenv").config()
const User = require('./models/User')

function authenticateToken(req, res, next) {
    const authHeader = req.headers["authorization"]
    const token = authHeader && authHeader.split(" ")[1]
    if (token == null) return res.status(401).json({
        'status': 'failure',
        'message': "not allowed"
    });

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, async (err, user) => {
        if (err) return res.status(401).json({
            "status": "failure",
            "message": "Your session has expired. Please log in again."
        })


        req.user = user
        const users = await User.findById(req.user.id);
        if(!users){
            return res.status(401).json({
                "status": "failure",
                "message": "User not found."
            })
        }
        if (users.role == "admin" && req.originalUrl.startsWith("/api/v1/admin")) {
            return next();
        } else if (users.role == "customer" && req.originalUrl.startsWith("/api/v1/customer")) {
            return next();
        } else if (users.role == "user" && req.originalUrl.startsWith("/api/v1/user")) {
            return next();
        }

        // IF the user role doesn't match with any of the roles possible [USER , ADMIN , POSTER]
        // then return an error with access denied!
        return res.status(403).json({
            status: "failure",
            message: "Access forbidden. Invalid user.",
        });
    });
}
module.exports = authenticateToken;