'use strict';

// include configuration and dependencies
const nodemailer = require('nodemailer');
const firebase = require('firebase');
const config = require('./config.js');
const sender = require('./sender.js');

// setup firebase connection and database refs
firebase.initializeApp(config);

const fbOrders = firebase.database().ref('/orders');
const fbWorkshops = firebase.database().ref('/workshops');
const fbUsers = firebase.database().ref('/users');

// CHECKS CHANGES ON ORDERS
fbOrders.on('child_changed', function(snapshot) {
  let userData = snapshot.val();
  let workshopName = '';
  const users = {};

  fbWorkshops.once('value')
    .then((snapshot) => {
      return new Promise((resolve, reject) => {
        let data = snapshot.child(userData.workshopId).val();
        workshopName = data.name;
        resolve(data.uid);
      });
    })
    .then((userId) => {
      fbUsers.once('value')
      .then((snapshot) => {
        return new Promise((resolve, reject) => {
          let data = [];
          snapshot.forEach((child) => {
            if(child.val().userId === userId) {
              users.rep = child.val();
            }
            if(child.val().isButcher) {
              users.butcher = child.val();
            }
          });
          resolve(users);
        });
      })
      .then((users) => {
        let data = {
          workshop: workshopName,
          newQuantity: userData.quantity,
          bundleName: userData.bundleName,
          isSpecialOrder: userData.specialOrder
        };

        console.log('USERS: ', users);
        console.log('MESSAGE DATA: ', data);
        sendEmail(users, data);
      });
    });

});

// CHECK FOR NEW OR UPDATED WORKSHOPS
fbWorkshops.on('child_changed', function(shapshot) {
  let workshop = snapshot.val();



});


// Called by watchers to send email
var sendEmail = function(users, data) {
  let smtpTransport = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: sender.user,
        pass: sender.pass
      }
  });

  let message = `${users.rep.name} (${users.rep.email}) just updated the workshop ${data.workshop}! \n The bundle ${data.bundleName} is now at a quantity of ${data.newQuantity}.\n`;
      message += data.isSpecialOrder ? '**It is a special order so some meats have changed!**' : 'This is a NORMAL order.';

  let mailOptions = {
    from: "WildTreeApp <wildtreeApp@gmail.com>",
    to: users.butcher.email,
    subject: `The workshop "${data.workshop}" was updated!`,
    text: message
  };

  smtpTransport.sendMail(mailOptions, function(error, response){
    if(error){
      console.log(error);
    } else {
      console.log("Message sent: " + response.message);
    }
    smtpTransport.close();
  });
};
