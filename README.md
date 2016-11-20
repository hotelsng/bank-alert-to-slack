# Receive Bank Alerts As Slack Notification

Receive Bank Alerts As Slack Notifications. Compatible with GTBank, First Bank, Zenith Bank, UBA &amp; Skye Bank. You need to activate email bank alerts.

### Installation

* Create a new Google script and create a cron for it using the Google Scripts application.
* Create an endpoint using a language of your choice and add the url to `alert.js`. It should log alerts, and return an array of new alerts. If you use **Laravel** we added a sample controller and a simple database schema you can use. It is meant to give you an idea on how to implement the endpoint.
