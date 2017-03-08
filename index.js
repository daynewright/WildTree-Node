'use strict';

const nodemailer = require('nodemailer');
const firebase = require('firebase');
var config = require('./config.js');
var sender = require('./sender.js');

firebase.initializeApp(config);

const fbOrders = firebase.database().ref('/orders');
const fbWorkshops = firebase.database().ref('/workshops');

fbOrders.on('child_added', function(snapshot) {
  let userData = snapshot.val();
  let smtpTransport = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: sender.user,
        pass: sender.pass
      }
  });

  let mailOptions = {
    from: "WildTreeApp <wildtreeApp@gmail.com>",
    to: 'daynewr@gmail.com',
    subject: 'Test Email',
    text: `Just a simple test email to see if something is sent.`
  };

  smtpTransport.sendMail(mailOptions, function(error, response){
    if(error){
      console.log(error);
    } else {
      console.log("Message sent: " + response.message);
    }
    smtpTransport.close();
  });

});
