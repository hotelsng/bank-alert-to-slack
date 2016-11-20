/**
 * Configuration values.
 */

var slackBotUsername = 'Finance';
var slackChannel     = '#notifications';
var slackToken       = 'YOUR-SLACK-TOKEN-HERE';


/**
 * Test if the Slack integration is working.
 *
 * @param  {string} message
 * @return {void}
 */
function sendSlackNotification(message){
  message = message || "*Testing Finance Notifications*";
  var response = UrlFetchApp.fetch("https://slack.com/api/chat.postMessage?", {
    method:"POST",
    payload:{
        "text":message,
        "token":slackToken,
        "channel":slackChannel,
        "username":slackBotUsername,
        "icon_emoji":":chart_with_upwards_trend:"
    }
  });
}


/**
 * Where all the magic happens.
 *
 * Parses the emails and gets the alert details received and
 * posts it to a Slack channel.
 *
 * @return {void}
 */
function mainFunction() {
    var slackPayload = {data:[]};

    var postToSlack = "";

    var searchQuery = 'subject:"GeNS Transaction Alert" OR '+
                      'subject:"FirstBank Alert On Your Account" OR '+
                      'subject:"(UBA ALERT)" OR '+
                      'subject:"Transaction Notification for HOTEL BOOKING LTD" OR '+
                      'subject:"Skye Bank - Credit Alert" OR '+
                      'subject:"Skye Bank - Debit Alert"';

    var messagesInThread = [];

    var threads = GmailApp.search(searchQuery, 0, 50);

    threads.forEach(function(thread) {
        Array.prototype.push.apply(messagesInThread, thread.getMessages());
    });

    var start = 0, stop  = 100;

    var messagesCount = messagesInThread.length;

    var postToSlack = " Parsing " + (start + 1) + " to " + (stop) + " of " + messagesCount;

    messagesInThread  = messagesInThread.slice(start, stop);

    messagesInThread.forEach(function(msg) {
        var subject   = msg.getSubject(),
            sender    = msg.getFrom(),
            messageid = msg.getId(),
            data      = undefined;

        // Skye Bank
        if (~sender.indexOf("skyebankng")) {
            data = extractDetailsSkye(msg.getBody(), subject);
        }

        // First Bank
        else if (~sender.indexOf("firstbanknigeria")) {
            data = extractDetailsFirstBank(msg.getBody(), subject);
        }

        // UBA
        else if (~sender.indexOf("ubagroup")){
            data = extractDetailsUBA(msg.getBody(), subject);
        }

        // GTBank
        else if (~sender.indexOf("gtbank")) {
            data = extractDetailsGTB(msg.getBody(), subject);
        }

        // Zenith Bank
        else if (~sender.indexOf("zenithbank")) {
            data = extractDetailsZenith(msg.getBody(), subject);
        }

        formatSlackMessage(data, messageid);
    });

    sendToEndpoint(slackPayload);

    /**
     * Send to the endpoint.
     *
     * @param  {Object} payload
     * @return {void}
     */
    function sendToEndpoint(payload) {
        var response = UrlFetchApp.fetch("http://finance.place/api/logalert",{
            method:"POST",
            payload:{data:JSON.stringify(payload.data)}
        });

        var slackMessage   = "";
        var upsertedAlerts = JSON.parse(response.getContentText());

        upsertedAlerts.forEach(function (ualert) {
            slackMessage += generateSlackMessage(ualert);
        });

        if (slackMessage.length > 1) {
            sendSlackNotification(slackMessage);
        }
    }


    /**
     * Generate the alert message to send to Slack.
     *
     * @param  {Object} parsedObject
     * @return {string}
     */
    function generateSlackMessage(parsedObject) {
        var message = "";

        if (parsedObject.AccName !== "") {
            message +=  "\n*********\n"      +
                        "Bank: "             + parsedObject.bank_name + "\n" +
                        "Account Name: "     + parsedObject.account_name + "\n" +
                        "Transaction Type: " + parsedObject.type + "\n" +
                        "Account Number: "   + parsedObject.account_number + "\n" +
                        "Amount: "           + parsedObject.amount + "\n" +
                        "Date: "             + parsedObject.created_on + "\n" +
                        "Details: "          + parsedObject.remark + "\n" +
                        "Message ID:"        + parsedObject.google_email_id + "\n\n";
        }

        return message;
    }


    // ------------------------------------------------------
    // Formatting
    // ------------------------------------------------------

    function stripExcessSpaces(text) {
        return text.replace(/\s\s\s*/g,'');
    }

    function stripTags(text){
        if (text && text != "") {
            return stripExcessSpaces(text.replace(/<\w*?.*?>.*?<\/\w*?>/g,'').trim());
        }

        return text;
    }

    function formatAmount(amount) {
        return amount.replace(/[a-zA-Z,]*/g,'');
    }

    function formatSlackMessage(transaction, id) {
        var pts = {
            google_email_id: id,
            account_name: stripTags(transaction.AccName),
            account_number: stripTags(transaction.AccNum),
            amount: formatAmount(stripTags(transaction.Amount)),
            created_on: stripTags(transaction.Date),
            remark: stripTags(transaction.Remark),
            type: transaction.TransType.trim(),
            bank_name: transaction.Bank,
            has_transactions: 0
        };

        if (transaction.AccName !== "") {
            postToSlack += "\n*********\n" +
                           "Bank: " + stripTags(transaction.Bank) + "\n" +
                           "Account Name: " + stripTags(transaction.AccName) + "\n" +
                           "Transaction Type: " + stripTags(transaction.TransType.trim()) + "\n" +
                           "Account Number: " + stripTags(transaction.AccNum) + "\n" +
                           "Amount: " + stripTags(transaction.Amount) + "\n" +
                           "Date: " + stripTags(transaction.Date) + "\n" +
                           "Details: " + stripTags(transaction.Remark) + "\n" +
                           "Message ID:" + stripTags(id) + "\n\n";

            slackPayload.data.push(pts);
        }
    }

    // ------------------------------------------------------
    // Extract Alert Details
    // ------------------------------------------------------


    /**
     * Extract details for GTBank
     *
     * @param  {string} emailBody
     * @param  {string} emailSubject
     * @return {Object}
     */
    function extractDetailsGTB(emailBody, emailSubject) {
        var dataForExtraction = [
            "Account Number",
            "Transaction Location",
            "Description",
            "Amount",
            "Value Date",
            "Remarks",
            "Time of Transaction"
        ];

        emailBody = emailBody.replace(/\r?\n|\r|<span .*?>|<\/span>|<h1><\/h1>/g,'');

        var pattern_start = "<TD.*?>\\s*";
        var pattern_end   = "\\s*<\/TD>\\s*<TD.*?>\\s*:\\s*<\/TD>\\s*<TD.*?>(.*?)\\s*<\/TD>";

        var parsed = {};
        var parseRegEx;

        dataForExtraction.forEach(function(e) {
            parseRegEx = new RegExp(pattern_start + e + pattern_end);
            var matched = emailBody.match(parseRegEx);
            parsed[e.replace(':', '')] = matched ? matched[1] : "";
        });

        var transactiontype = (~emailBody.indexOf('Debit')) ? "DEBIT" : "CREDIT";

        return {
            "AccName":"N/A",
            "AccNum":parsed["Account Number"],
            "Amount":parsed["Amount"],
            "Date":parsed["Value Date"] + " " + parsed["Time of Transaction"],
            "Remark":parsed["Description"],
            "TransType":transactiontype,
            "Bank":"GTB"
        };
    }

    /**
     * Extract details for UBA
     *
     * @param  {string} emailBody
     * @param  {string} emailSubject
     * @return {Object}
     */
    function extractDetailsUBA(emailBody, emailSubject) {
        var dataForExtraction = [
            "Transaction Type",
            "Transaction Amount",
            "Transaction Currency",
            "Account Number",
            "Transaction Narration",
            "Transaction Remarks",
            "Date and Time",
            "Account Name",
            "Cleared Balance",
            "Transaction Type"
        ];

        emailBody = emailBody.replace(/\r?\n|\r/g,'');

        var pattern_start = "<td .*?>";
        var pattern_end = "<\/td>\\s*<td .*?>(.*?)<\/td>";

        var parsed = {};
        var parseRegEx;

        dataForExtraction.forEach(function(e) {
            parseRegEx = new RegExp(pattern_start + e + pattern_end);
            var matched = emailBody.match(parseRegEx);
            parsed[e.replace(':', '')] = matched ? matched[1] : "";
        });

        return {
            "AccName":parsed["Account Name"],
            "AccNum":parsed["Account Number"],
            "Amount":parsed["Transaction Amount"],
            "Date":parsed["Date and Time"],
            "Remark":parsed["Transaction Narration"],
            "TransType":parsed["Transaction Type"],
            "Bank":"UBA"
        };
    }

    /**
     * Extract details for Skye bank
     *
     * @param  {string} emailBody
     * @param  {string} emailSubject
     * @return {Object}
     */
    function extractDetailsSkye(emailBody, emailSubject) {
        var dataForExtraction = [
            "Account Name",
            "Account Number",
            "Amount",
            "Details",
            "Balance",
            "Time"
        ];

        emailBody = emailBody.replace(/\r?\n|\r/g,'');

        var pattern_start = "<td>";
        var pattern_end = "\\s*<\/td>\\s*<td>(.*?)\\s*<\/td>";

        var parsed = {};
        var parseRegEx;

        dataForExtraction.forEach(function(e) {
            parseRegEx = new RegExp(pattern_start + e + pattern_end);
            var matched = emailBody.match(parseRegEx);
            parsed[e.replace(':', '')] = matched ? matched[1] : "";
        });

        var transactiontype = (~emailBody.indexOf('Debit')) ? "DEBIT" : "CREDIT";

        return {
            "AccName":parsed["Account Name"],
            "AccNum":parsed["Account Number"],
            "Amount":parsed["Amount"],
            "Date":parsed["Time"],
            "Remark":parsed["Details"],
            "TransType":transactiontype,
            "Bank":"Skye Bank"
        };
    }

    /**
     * Extract details for First Bank
     *
     * @param  {string} emailBody
     * @param  {string} emailSubject
     * @return {Object}
     */
    function extractDetailsFirstBank(emailBody, emailSubject) {
        var dataForExtraction = [
            "Account Number:",
            "Amount:",
            "Transaction Narrative:",
            "Transaction Date:"
        ];

        emailBody = emailBody.replace(/\r?\n|\r|<strike>|<\/strike>|<h1><\/h1>/g,'');

        var pattern_start = "<td.*?><h1>";
        var pattern_end = "\\s*</h1><\/td>\\s*<td.*?><h1>(.*?)\\s*</h1><\/td>";

        var pattern = "<td.*?><h1>Account Number:\\s*</h1><\/td>\\s*<td.*?><h1>(.*?)\\s*</h1><\/td>";

        var parsed = {};
        var parseRegEx;

        dataForExtraction.forEach(function(e) {
            parseRegEx = new RegExp(pattern_start + e + pattern_end);
            var matched = emailBody.match(parseRegEx);
            parsed[e.replace(':', '')] = matched ? matched[1] : "";
        });

        var transactiontype = (~emailSubject.indexOf('DEBIT')) ? "DEBIT" : "CREDIT";

        return {
            "AccName":"N/A",
            "AccNum":parsed["Account Number"],
            "Amount":parsed["Amount"],
            "Date":parsed["Transaction Date"],
            "Remark":parsed["Transaction Narrative"],
            "TransType":transactiontype,
            "Bank":"First Bank"
        };
    }

    /**
     * Extract details for Zenith Bank
     *
     * @param  {string} emailBody
     * @param  {string} emailSubject
     * @return {Object}
     */
    function extractDetailsZenith(emailBody, emailSubject) {
        var dataForExtraction = [
            "Account Number",
            "Description",
            "Currency",
            "Amount",
            "Date of Transaction",
            "Trans. Type"
        ];

        emailBody = emailBody.replace(/\r?\n|\r|<div .*?>|<\/div>|<td><\/td>|&nbsp;&nbsp;|<strong>|<\/strong>|<h1><\/h1>/g,'');

        var pattern_start = "<th.*?>";
        var pattern_end   = "<\/th><td>(.*?)<\/td>";

        var parsed = {};
        var parseRegEx;

        dataForExtraction.forEach(function(e) {
            parseRegEx = new RegExp(pattern_start + e + pattern_end);
            var matched = emailBody.match(parseRegEx);
            parsed[e] = matched ? matched[1] : "";
        });

        return {
            "AccName":"N/A",
            "AccNum":parsed["Account Number"],
            "Amount":parsed["Amount"],
            "Date":parsed["Date of Transaction"],
            "Remark":parsed["Description"],
            "TransType":parsed["Trans. Type"],
            "Bank":"Zenith Bank"
        };
    }
}
