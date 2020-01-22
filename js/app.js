var GOOGLE_API_KEY = "",
  FOURSQUARE_CLIENT_ID = "",
  FOURSQUARE_CLIENT_SECRET = "",
  YELP_CLIENT_ID = "",
  YELP_API_KEY = "";

window.gm_authFailure = () => {
  alert("Google Maps Failed authentication...");
  throw new Error("Google Maps Failed authentication...");
};

// Location object that holds all venue data
var Location = function(data) {
  this.name = ko.observable(data.name);
  this.lat = ko.observable(data.location.lat);
  this.lng = ko.observable(data.location.lng);
  this.address = ko.observable(data.address);
  this.photos = ko.observable(data.photos);
  this.foursquareRating = ko.observable('Loading...');
  this.yelpRating = ko.observable('Loading...');
  this.yelpStatus = ko.observable('Loading...');
  this.wikipediaSnippet = ko.observable('Loading...');
  this.showWikipedia = ko.observable(false);  
};

// Initial object that we use for google maps pins and to create our data objects
let initialPlaces = [
    {
      name: "Römerberg",
      location: {lat: 50.110325, lng: 8.682062},
    },
    {
      name: "Goethe House",
      location: {lat: 50.111209, lng: 8.677760},
    },
    { 
      name: "Palmengarten",
      location: {lat: 50.123176, lng: 8.657865},
    },
    {
      name: "Senckenberg Natural History Museum",
      location: {lat: 50.117534, lng: 8.651703},
    },
    {
      name: "Kaiserdom St. Bartholomäus",
      location: {lat: 50.110655, lng: 8.685436},
    }
  ];

var myViewModel = {
  init: function () { // Initalize our objects so that we can hold our data in different arrays
    let that = this;
    this.fullPlacesList = ko.observableArray([]); // Holds all venues
    this.optionBarList = ko.observableArray([]); // Displays certain venues to screen
    this.query = ko.observable();

    initialPlaces.forEach( function(place) { // Creates our data objs in ko array
      that.fullPlacesList.push( new Location(place) );
    });

    this.fullPlacesList().forEach( function(place) { // Pulls data from relevant services and adds to our main array
      place.photos(`https://maps.googleapis.com/maps/api/streetview?size=200x200&location=${place.lat()},${place.lng()}&fov=90&heading=235&pitch=10&key=${GOOGLE_API_KEY}`); 
      that.getFoursquareData(place);
      that.getYelpData(place);
      that.getWikipediaData(place);
      that.optionBarList().push(place); // Adds data objs to sidebar
    });   
  },

  // Sets bounce on marker
  toggleBounce: function (marker) {
    if (marker.getAnimation() !== null) {
      marker.setAnimation(null);
    } else {
      marker.setAnimation(google.maps.Animation.BOUNCE);
    
      setTimeout(function() {
        marker.setAnimation(null);
      }, 2000);
    }
  },
  
  // Finds corresponding marker based on venue to bounce
  bounceMarker: function (place) {
    let name = place.name();
    showExtraPlaceInfo();
    markers.forEach( function (marker) {
      if (name === marker.title) {
        myViewModel.toggleBounce(marker);
      }
    });

    //makes the extra information visible in the sidebar
    function showExtraPlaceInfo() {
      for (let i = 0; i < myViewModel.fullPlacesList().length; i++) { // Hides all extra info
        myViewModel.fullPlacesList()[i].showWikipedia(false);
      }
    
      if (place.showWikipedia() === false) {
        place.showWikipedia(true);
      } else {
        place.showWikipedia(false);
      }
    }
  },


  // Opens infowindow for marker on click
  populateInfoWindow: function (marker, infowindow) {
    let place;
    for (let i=0; i < myViewModel.fullPlacesList().length; i++) {
      if (marker.title === myViewModel.fullPlacesList()[i].name() ) {
        place = myViewModel.fullPlacesList()[i];
      }
    }

    let markerContent = `<div id="location"><h1>${marker.title}</h1>
          <div id="wiki-container">
            <div class="wikipedia-infowindow">
              <span class="wikipedia-logo-container">
                <img id="wikipedia-logo" src="images/WIkipedia_wordmark.svg" alt="Wikipedia">
              </span>
              <img class="place-picture" src="${place.photos()}">
              <div id="wikipedia">${place.wikipediaSnippet()}</div>
            </div>
          </div>
        </div>`;

    // Check to make sure the infowindow is not already opened on this marker.
    if (infowindow.marker != marker) {
      infowindow.marker = marker;
      //infowindow.setContent('<div>' + marker.title + '</div>');
      infowindow.setContent(markerContent);
      infowindow.open(map, marker);
      // Make sure the marker property is cleared if the infowindow is closed.
      infowindow.addListener('closeclick', function(){
        infowindow.setMarker = null;
      });
    }
  },
  // Using the Foursquare API to get a rating
  getFoursquareData: function (place) {
    let name = encodeURIComponent(place.name()),
      getPlaceId = `https://api.foursquare.com/v2/venues/search?ll=${place.lat()},${place.lng()}&query=${place.name()}&client_id=${FOURSQUARE_CLIENT_ID}&client_secret=${FOURSQUARE_CLIENT_SECRET}&v=20181030`;

    $.ajax ({
      url: getPlaceId,
      timeout: 5000
    })
    .done(function (placeData) {
      if (placeData.response.venues.length !== 0) {
        let venueId = placeData.response.venues[0].id,
          findPlaceInfo = `https://api.foursquare.com/v2/venues/${venueId}?client_id=${FOURSQUARE_CLIENT_ID}&client_secret=${FOURSQUARE_CLIENT_SECRET}&v=20181030`;

        $.ajax ({
          url: findPlaceInfo,
          timeout: 5000
        })
        .done(function (findResponse) {
          if (typeof findResponse.response.venue.rating !== "undefined") {
            place.foursquareRating(findResponse.response.venue.rating);
          } else {
            place.foursquareRating("N/A");
          }
        })
        .fail(function(err) {
          place.foursquareRating("N/A");
        });
      } else {
        place.foursquareRating("N/A");
        alert(place.name() + " was not found on Foursquare.");
      }
    })
    .fail(function (err) { //http://jsnlog.com/Documentation/HowTo/AjaxErrorHandling
      place.foursquareRating("Error");
    });
  },

  /* Yelp Fusion API doesn't support Javascript (creates CORS problems) so we use a proxy to get around it.
   * https://stackoverflow.com/questions/51391801/cannot-retrieve-data-from-yelp-api-using-jquery-ajax
   */
  getYelpData: function (place) {
    let name = encodeURIComponent(place.name()),
      findPlaceId = `https://cors-anywhere.herokuapp.com/https://api.yelp.com/v3/businesses/search?term=${name}&latitude=${place.lat()}&longitude=${place.lng()}`;

    $.ajax ({
      url: findPlaceId,
      type: 'GET',
      timeout: 10000,      
      headers: {
        'X-Requested-With': 'XMLHttpRequest',
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Authorization': 'Bearer ' + YELP_API_KEY,
      },
    })
    .done (function (data){
      if (typeof data.businesses[0].rating !== "undefined") {
        place.yelpRating(data.businesses[0].rating);
      } else {
        place.yelpRating("N/A");
      }
      if (typeof data.businesses[0].is_closed !== "undefined") {
        if (data.businesses[0].is_closed === true) {
          place.yelpStatus("Closed");
        } else {
          place.yelpStatus("Open");
        }
      } else {
        place.yelpStatus("N/A");
      }      
    })
    .fail (function (err){
      place.yelpRating("Error");
      place.yelpStatus("Error");
    });
  },

  /* MediaWiki API doesn't support CORS so we use a proxy to get around it.
   * https://stackoverflow.com/questions/51391801/cannot-retrieve-data-from-yelp-api-using-jquery-ajax
   */
  getWikipediaData: function (place) {
    let getSearch = `https://cors-anywhere.herokuapp.com/https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${place.name()}&utf8=&format=json`;

    $.ajax({
      url: getSearch,
      timeout: 10000,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'X-Requested-With': 'XMLHttpRequest',
        'Content-Type': 'application/json'
      },
    })
    .done(function (data){
      if (typeof data.query.search[0].snippet !== "undefined"){
        let snippet = data.query.search[0].snippet;
        let index = 7 + snippet.lastIndexOf('</span>');        
        snippet = snippet.replace(/&quot;/g, '"').replace(/<span class="searchmatch">/g, '').replace(/<\/span>/g, '');
        place.wikipediaSnippet(snippet + "...");
      } else {
        place.wikipediaSnippet("N/A");
      }
    })
    .fail(function (err) {
      place.wikipediaSnippet("Error");
    });
  },

  // https://opensoul.org/2011/06/23/live-search-with-knockoutjs/
  // Upon typing in search - clears array and adds as venues are found
  search: function (search) {
    myViewModel.optionBarList.removeAll();
    for (var x in myViewModel.fullPlacesList() ) {
      if ( myViewModel.fullPlacesList()[x].name().toLowerCase().indexOf(search.toLowerCase()) >= 0) {
        myViewModel.optionBarList.push(myViewModel.fullPlacesList()[x] );
      }
    }

    // Searches markers for a match
    for (let i in markers){
      if ( markers[i].title.toLowerCase().indexOf(search.toLowerCase()) >= 0) {
        markers[i].setMap(map);          
      } else {
        markers[i].setMap(null);
      }
    }
  },
};

var map,
  markers = [];

var initMap = function() { //From project code 3 windowshopping part1
  map = new google.maps.Map(document.getElementById('map'), {
      center: {lat: 50.113214, lng: 8.651460},
      zoom: 13
    });
  var largeInfowindow = new google.maps.InfoWindow();
  var bounds = new google.maps.LatLngBounds();

  // The following group uses the location array to create an array of markers on initialize.
  for (var i = 0; i < initialPlaces.length; i++) {
    // Get the position from the location array.
    var position = initialPlaces[i].location;
    var name = initialPlaces[i].name;
    // Create a marker per location, and put into markers array.
    var marker = new google.maps.Marker({
      map: map,
      position: position,
      title: name,
      animation: google.maps.Animation.DROP,
      id: i
    });
    // Push the marker to our array of markers.
    markers.push(marker);
    // Create an onclick event to open an infowindow at each marker.
    marker.addListener('click', function() {
      myViewModel.toggleBounce(this);
      myViewModel.populateInfoWindow(this, largeInfowindow);
    });
    bounds.extend(markers[i].position);
  }
  // Extend the boundaries of the map for each marker
  map.fitBounds(bounds);  

  let request,
    findPlace;

  // Use the Google Maps API to find addresses for venues
  findPlace = new google.maps.places.PlacesService(map);

  initialPlaces.forEach( function(place) {
    request = {
      query: place.name,
      fields: ['formatted_address', 'name'],
    };

    let findPlaceCall = new Promise( (resolve, reject) => {
      findPlace.findPlaceFromQuery(request, function callback(results, status) {
        if (status == google.maps.places.PlacesServiceStatus.OK) {
          for (var i = 0; i < results.length; i++) {
            let locationData = results[i];
            resolve(locationData);
          }
        }
      });   
    })
    .then( (result) => {
      let findIndex,
        index;
      for (let x = 0; x < myViewModel.fullPlacesList().length; x++) {
        findIndex = myViewModel.fullPlacesList()[x].name().indexOf( place.name );
        if (findIndex != -1) {
          index = x;
          myViewModel.fullPlacesList()[index].address(result.formatted_address);
        }
      }
    })
    .catch( (failureCallback) => {
      if(typeof failureCallback !== "undefined") {
        alert(failureCallback);
      }
      throw new Error("There was an error resolving Google FindPlace API.");
    });
  });
};

myViewModel.init();
myViewModel.query.subscribe(myViewModel.search);
ko.applyBindings( myViewModel );
