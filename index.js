'use strict';

// include configuration and dependencies
const nodemailer = require('nodemailer');
const schedule = require('node-schedule');
const firebase = require('firebase');
const moment = require('moment');
const config = require('./config.js');
const sender = require('./sender.js');

// setup firebase connection and database refs
firebase.initializeApp(config);

const fbOrders = firebase.database().ref('/orders');
const fbWorkshops = firebase.database().ref('/workshops');
const fbUsers = firebase.database().ref('/users');
const fbMessages = firebase.database().ref('/conversations');

console.log('Wildtree email server running!');

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

//CHECK FOR UNREAD MESSAGES DAILY
var runJob = schedule.scheduleJob({hour: 20, minute: 5}, function() {
  fbMessages.on('child_added', (snapshot) => {
     const convo = snapshot.val();
     const lastMsg = convo.messages[convo.messages.length-1];
     let sender = {};
     let receiver = {};

     if(!lastMsg.read){
       if(lastMsg.authorId === convo.fullUsers[1].userId){
        receiver = convo.fullUsers[0];
        sender = convo.fullUsers[1];
       } else {
        receiver = convo.fullUsers[1];
        sender = convo.fullUsers[0];
       }
       const emailObj = {
         subject: `You have unread messages`,
         message: `You currently have at least one unread message from ${sender.name} (${sender.email}).\n\nMESSAGE: "${lastMsg.text}"\n\n(*Replying to this email will go to the author, but does not post in the app.*)`,
         sendTo: receiver.email,
         replyTo: sender.email
       };
       sendEmail(emailObj);
     }
  });
  console.log('**testing scheduled job**');
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
    text: emailObj.message,
    replyTo: emailObj.replyTo || "wildtreeApp@gmail.com"
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
