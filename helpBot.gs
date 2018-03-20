var ss = SpreadsheetApp.openById("1WdWFGpjbQ6St9BaMSJHyR2Druc698sU-T4VLwNFWXAI");
var sheet = ss.getSheetByName("db");
var DEFAULT_IMAGE = "https://d30y9cdsu7xlg0.cloudfront.net/png/568541-200.png";
var HEADER = {
  header: {
    title: "ECS Helpbot",
    subtitle:"Get help now",
    imageUrl: DEFAULT_IMAGE,
    imageStyle: "IMAGE"
  }
}

/**
 * Responds to an ADDED_TO_SPACE event in Hangouts Chat.
 *
 * @param {Object} event the event object from Hangouts Chat
 */
function onAddToSpace(event) {
  var message = '';

  if (event.space.type == 'DM') {
    message = 'Thanks for adding me! I\'ll give you videos based on a search term. Try searching for "gmail" or "calendar" to get started.';
  } else {
    message = 'Thank you for adding me to ' + event.space.displayName;
  }

  return { text: message };
}

/**
 * Responds to a REMOVED_FROM_SPACE event in Hangouts Chat.
 *
 * @param {Object} event the event object from Hangouts Chat
 */
function onRemoveFromSpace(event) {
  console.info('Bot removed from ', event.space.name);
}

/**
 * Responds to a MESSAGE event in Hangouts Chat.
 *
 * @param {Object} event the event object from Hangouts Chat
 */
function onMessage(event) {
  var msg = event.message.text;
  
  msg = msg.replace("@ECS Helpbot ", "");
  
  msg = msg.split(" ");
  
  Logger.log(msg);
  
  // Look up the search string in the spreadsheet
  // Return an array of video URLs with matching tags
  Logger.log('Look up the search key');
  var videos = getLookup(msg); // array
  
  Logger.log(videos);
  
  // Extract the video thumbnail from the YouTube API
  // Return an array of objects - videos.url, videos.thumbail
  var videoObjects = getVideos(videos);
  
  Logger.log(videoObjects);
  // return the card
  return buildCard(videoObjects);
}

// Look up the video by ID
// return the thumbnail image
function getVideos(array) {
  
  // Loop the URLs in the array
  for(var v=0; v<array.length; v++) {
    
    // Split to get the video ID
    var videoId = array[v].url.split("=")[1];
    
    // YouTube API v3, return the snippet with video metadata
    // Build the resource object
    var videoResource = YouTube.Videos.list('snippet', {id:videoId });
    array[v].thumb = videoResource.items[0].snippet.thumbnails.standard.url;
    array[v].title = videoResource.items[0].snippet.title;
  }
  
  // send the object to build the response widget
  return array;
}

// Get an array of videos matching the search key request
// @param [Array] - search keys split by space
function getLookup(keys) {
  var sheet = ss.getSheetByName("db");
  var data = sheet.getDataRange().getValues();
  
  // Create an array to hold matching results
  var matches = [];
  
  // Build the regex
  var expr = '^';
  for(var s=0; s<keys.length; s++) {
    expr += '(?=.*\\b' + keys[s] + '.*\\b)';
  }
  expr += '.*$'
  expr = new RegExp(expr, "gi");
  
  for(var i=0; i<data.length;i++) {
    var string = data[i][0].concat(", ", data[i][1]);
    
    // Use string.match instead of expr.test() because the latter advances the index, 
    // resulting in incomplete results.
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp/test
    if(string.match(expr)) {
      matches.push({"url":data[i][4], "title":data[i][2]})
    } 
  }
  
  // process the matches array to delete duplicate URLs
  var matches = uniqBy(matches, JSON.stringify);
  
  // A blank url key will cause an error on the YouTube API.
  // Remove any matches that have a blank URL field.
  matches = matches.filter(function(a) { return a.url !== "" });
  
  return matches;
}

// Filter the array of objects with matching keys
// https://stackoverflow.com/questions/9229645/remove-duplicate-values-from-js-array
function uniqBy(a, key) {
    var seen = {};
    return a.filter(function(item) {
        var k = key(item);
        return seen.hasOwnProperty(k) ? false : (seen[k] = true);
    })
}

function buildWidgets(array) {
  var widgets = [];
  var num;
  
  if(array.length == 0) {
    widgets.push({ textParagraph: { text: "I couldn't find any videos. <a href='" + ScriptApp.getService().getUrl() + "'>Check the website</a> for more articles that may help." } });
  } else if(array.length == 1) {
    num = "video";
    widgets.push({
      textParagraph: { text: "I found " + array.length + " video that may help:" }
    });
  } else {
    widgets.push({
      textParagraph: { text: "I found " + array.length + " videos that may help:" }
    });
  }
 
  
  for(var i=0; i<array.length; i++) {
    widgets.push(
      {
        keyValue: {
          content: array[i].title,
        }
      },
      {
        image: { imageUrl: array[i].thumb }
      },
      {
        buttons: [{
          textButton: {
            text: "OPEN VIDEO",
            onClick: {
              openLink: {
                url: array[i].url
              }
            }
          }
        }]
      }
    );
  }
  return widgets
}

function buildCard(array) {
  var widgets = buildWidgets(array);
  
  var cardJson = {
    cards: [HEADER, {
      sections: [{
        widgets: widgets
      }]
    }]
  }

  return cardJson
}

