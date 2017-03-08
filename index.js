'use strict';

// include configuration and dependencies
const nodemailer = require('nodemailer');
const firebase = require('firebase');
const moment = require('moment');
const config = require('./config.js');
const sender = require('./sender.js');

// setup firebase connection and database refs
firebase.initializeApp(config);

const fbOrders = firebase.database().ref('/orders');
const fbWorkshops = firebase.database().ref('/workshops');
const fbUsers = firebase.database().ref('/users');

// CHECKS CHANGES ON ORDERS
fbOrders.on('child_changed', (snapshot) => {
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
      getUsers(userId)
      .then((users) => {
        let data = {
          workshop: workshopName,
          newQuantity: userData.quantity,
          bundleName: userData.bundleName,
          isSpecialOrder: userData.specialOrder
        };

        let emailObj = {
          subject : `The workshop "${data.workshop}" was updated!`,
          message: `${users.rep.name} (${users.rep.email}) just updated the workshop "${workshopName}"!\nThe bundle ${data.bundleName} is now at a quantity of ${data.newQuantity}.\n`,
          sendTo: users.butcher.email
        };
        emailObj.message += data.isSpecialOrder ? '\n**It is a special order so some meats have changed!**' : '\nThis is a NORMAL order.';

        sendEmail(emailObj);
      });
    });

});


// CHECK FOR NEW SUBMITTED WORKSHOPS
fbWorkshops.on('child_changed', (snapshot) => {
    let workshop = snapshot.val();

    if(workshop.isSubmitted && !workshop.isApproved) {
      getUsers(workshop.uid)
      .then((users) => {
        let emailObj = {
          subject: `New Workshop "${workshop.name}" submitted for pickup ${moment(workshop.date).format('MM/DD')} @ ${moment(workshop.time).format('hh:mma')}`,
          message: `A new workshop was just submitted by ${users.rep.name} (${users.rep.email}) for you to review and approve.\n\nWORKSHOP NAME: ${workshop.name}\nWORKSHOP PICKUP: ${moment(workshop.date).format('MM/DD')} @ ${moment(workshop.time).format('hh:mma')}\nREP NAME: ${users.rep.name}\nREP EMAIL: ${users.rep.email}`,
          sendTo: users.butcher.email
        }
        sendEmail(emailObj);
      });
    }

    if(workshop.isApproved){
      getUsers(workshop.uid)
      .then((users) => {
        let emailObj = {
          subject: `Workshop "${workshop.name}" was approved!`,
          message: `Your workshop "${workshop.name}" was approved for pickup on ${moment(workshop.date).format('MM/DD')} @ ${moment(workshop.time).format('hh:mma')} by ${users.butcher.name} (${users.butcher.email}).\nYou can continue to add orders until 2 days prior.`,
          sendTo: users.rep.email
        }
        sendEmail(emailObj);
      });
    }
});

//Get users helper function
let getUsers = (userId) => {
  return new Promise((resolve)=> {
    let users = fbUsers.once('value')
      .then((snapshot) => {
        return new Promise((resolve, reject) => {
          let data = [];
          snapshot.forEach((child) => {
            if(child.val().userId === userId) {
              data.rep = child.val();
            }
            if(child.val().isButcher) {
              data.butcher = child.val();
            }
          });
          resolve(data);
        });
      });
      resolve(users);
    });
};

// Called by watchers to send email
var sendEmail = function(emailObj) {
  let smtpTransport = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: sender.user,
        pass: sender.pass
      }
  });

  let mailOptions = {
    from: "WildTreeApp <wildtreeApp@gmail.com>",
    to: emailObj.sendTo,
    subject: emailObj.subject,
    text: emailObj.message
  };

  smtpTransport.sendMail(mailOptions, function(error, response){
    if(error){
      console.log(error);
    } else {
      console.log("Message sent: " + response.response);
    }
    smtpTransport.close();
  });
};
