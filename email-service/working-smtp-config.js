// Working SMTP Configuration - 2025-07-29T23:31:29.535Z
const nodemailer = require('nodemailer');

const createTransporter = () => {
    return nodemailer.createTransporter({
    "host": "mail.privateemail.com",
    "port": 587,
    "secure": false,
    "auth": {
        "user": "info@dreamexdatalab.com",
        "pass": "Imoudre@m77n"
    },
    "tls": {
        "rejectUnauthorized": false,
        "minVersion": "TLSv1.2"
    }
});
};

module.exports = { createTransporter };
