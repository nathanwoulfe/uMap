angular.module("umbraco").controller("uMap.GoogleMapsController",
    function ($rootScope, $scope, $filter, dialogService, assetsService) {

        var marker, geocoder, map, mapDiv, fields,            
            gMapMarkers = [];
            
        assetsService.loadJs('//www.google.com/jsapi')
            .then(function () {
                google.load("maps", "3.exp", {
                    callback: initMap,
                    other_params: "sensor=false&libraries=places"
                });
            });

        $scope.changeOpacity = function (i, o) {            
            marker = gMapMarkers[i];
            if ($scope.model.value[i].disabled !== true) {
                marker.setOpacity(o);
            }
        }

        $scope.removeMarkerClick = function (i) {
            marker = gMapMarkers[i];
            removeMarker(i);
        }

        $scope.disableMarkerClick = function (i) {
            marker = gMapMarkers[i];
            disableMarker(i);
        }

        $scope.centreMap = function (i) {
            map.panTo(gMapMarkers[i].getPosition());
            $scope.selectedMarkerId = i;
        }

        $scope.pageCounter = function (i) {
            $scope.currentPage = 0;
            $scope.pageCount = Math.ceil($scope.model.value.length / i);
        }

        $scope.paging = function (i) {
            if ($scope.currentPage + i >= 0 && $scope.currentPage + i <= $scope.pageCount - 1) {
                $scope.currentPage = $scope.currentPage + i;
            }
        }

        $scope.sortLocations = function (str) {

            if ($scope.orderByParam === str) {
                $scope.reverseOrder = !$scope.reverseOrder;
            }
            $scope.orderByParam = str;
            $scope.model.value.sort(dynamicSort($scope.reverseOrder ? '-' + str : str));
  
            setMarkers();
        }

        function initMap() {

            marker = new google.maps.Marker();
            geocoder = new google.maps.Geocoder();
            $scope.fields = $scope.model.config.additionalFields.split(',');
            $scope.currentPage = 0;
            $scope.pageSize = 5;
            $scope.pageCounter($scope.pageSize);
            
            // model should be an array - we'll be pushing and sorting
            if ($scope.model.value === '') {
                $scope.model.value = [];
            }

            // set the default if one exists and no model data
            if ($scope.model.value === '' && $scope.model.config.defaultLocation != null) {                

                var o = {};
                o['lat'] = $scope.model.config.defaultLocation.split(',')[0];
                o['lng'] = $scope.model.config.defaultLocation.split(',')[1];
                o['address'] = 'Default address';
                o['disabled'] = true;

                // add custom fields, if any
                if ($scope.fields.length != 0) {
                    var i, len = $scope.fields.length;
                    for (i = 0; i < len; i++) {
                        o[$scope.fields[i]] = ' ';
                    }
                }

                $scope.model.value.push(o);
            }

            // set initial center to 0,0 unless the model has a value
            var center = new google.maps.LatLng(0, 0);
            if ($scope.model.value != '') {
                center = new google.maps.LatLng($scope.model.value[0].lat, $scope.model.value[0].lng)
            }

            var mapOptions = {
                    zoom: 2,
                    center: center,
                    mapTypeId: google.maps.MapTypeId.ROADMAP,
                    mapTypeControl: false,
                    streetViewControl: false
                },                               
                input = document.getElementById('pac-input'),
                autocomplete = new google.maps.places.Autocomplete(input);

            mapDiv = document.getElementById($scope.model.alias + '_map');
            map = new google.maps.Map(mapDiv, mapOptions);

            autocomplete.bindTo('bounds', map);

            // add the points from the model data
            setMarkers();

            $scope.orderByParam = 'address';
            $scope.reverseOrder = false;
            if ($scope.model.value !== '') {
                $scope.sortLocations($scope.orderByParam);
            }

            // ADDLISTENER - map click
            // add new markers on click but not double click...
            var t = null;
            google.maps.event.addListener(map, "click", function (event) {
                t = setTimeout(function () {
                    addMarker(event.latLng);
                }, 200);
            });

            google.maps.event.addListener(map, 'dblclick', function (event) {
                clearTimeout(t);
            });

            // ADDLISTENER - autocomplete change
            // listen for autocomplete changes, then add marker 
            google.maps.event.addListener(autocomplete, 'place_changed', function () {

                var place = autocomplete.getPlace();
                if (!place.geometry) {
                    return;
                }

                // If the place has a geometry, then present it on a map.
                if (place.geometry.viewport) {
                    map.fitBounds(place.geometry.viewport);
                } else {
                    map.setCenter(place.geometry.location);
                    map.setZoom(9);  
                }

                addMarker(place.geometry.location);
                
            });

            // reinit map if user toggles backoffice tabs
            $('a[data-toggle="tab"]').on('shown', function (e) {
                google.maps.event.trigger(map, 'resize');
            });

        }

        // get geocoded address for latlng
        // add the location name to the appropriate marker object 
        function codeLatLng(i, latLng) {            
            mapDiv.className = mapDiv.className + " opacity-out";
            geocoder.geocode({
                'latLng': latLng
            },
                function (results, status) {
                    if (status == google.maps.GeocoderStatus.OK) {
                        var address = results[0].formatted_address;                        
                        $scope.model.value[i].address = address;                     
                        mapDiv.className = "transition-opacity";                        
                    } else {
                        notificationsService.error("ERROR", "Couldn't find valid location");
                        $scope.model.value[i].address = "Couldn't find valid location";
                    }
                    $scope.$apply();
                    $scope.sortLocations($scope.orderByParam);
                });            
        }

        function addMarker(latLng) {

            // new map maker at provided location
            marker = new google.maps.Marker({
                position: latLng,
                map: map,
                draggable: true                
            });

            // show the marker on the map
            marker.setMap(map);

            // add the marker to the mapping array - doesn't have an address just yet
            gMapMarkers.push(marker);

            // listen for events - clicks and drags, yeah! 
            addEventListeners();

            // push into model value
            var o = {};
            o['lat'] = latLng.lat();
            o['lng'] = latLng.lng();
            o['address'] = 'Looking up location...';
            o['disabled'] = false;

            $scope.model.value.push(o);
            var index = $scope.model.value.length - 1;

            // add custom fields to scoped marker
            if ($scope.fields.length != 0) {
                var i, len = $scope.fields.length;
                for (i = 0; i < len; i++) {
                    $scope.model.value[index][$scope.fields[i]] = ' ';
                }
            }

            // look up new marker location
            codeLatLng(index, marker.getPosition());
            
        }
        

        /* set listeners for drag and click */
        function addEventListeners() {

            /* and listen for marker drag end event */
            google.maps.event.addListener(marker, 'dragend', function (e) {
                marker = this;

                var i =marker.umbMarkerId
                    pos = marker.getPosition();

                //set the model value
                $scope.model.value[i].lat = pos.lat();
                $scope.model.value[i].lng = pos.lng();

                // look up new marker location
                codeLatLng(i, pos);                
            });

            // listen for clicks on existing markers and set as active
            google.maps.event.addListener(marker, 'click', function (event) {
                marker = this;
                $scope.selectedMarkerId = marker.umbMarkerId;
            });
        }       

        // sorter function keeps map markers in sync with scope values
        function dynamicSort(p) {
            var o = 1;
            if (p[0] === "-") {
                o = -1;
                p = p.substr(1);
            }
            return function (a, b) {
                var r = (a[p] < b[p]) ? -1 : (a[p] > b[p]) ? 1 : 0;
                return r * o;
            }
        }

        function removeMarker(i) {

            // better confirm that delete request...
            var ds = dialogService.open({
                template: '../App_Plugins/uMap/uMap_deleteDialog.html',
                scope: $scope,
                show: true,
                callback: done
            });

            function done(d) {
                if (d === true) {
                    // find the marker in scope, remove it 
                    $scope.model.value.splice(i, 1);

                    // find the marker in the gMapMarker array and remove it here too 
                    gMapMarkers.splice(i, 1);

                    // reset marker ids after removing object 
                    var j, len = gMapMarkers.length;
                    for (j = 0; j < len; j++) {
                        gMapMarkers[j].umbMarkerId = j;
                    }

                    // remove it from the map
                    marker.setMap(null);

                    if (i >= gMapMarkers.length) {
                        i = gMapMarkers.length - 1;
                    }

                    $scope.centreMap(i);
                }
            }

           
        }

        function disableMarker(i) {
            // toggle disabled for given marker       
            var m = $scope.model.value[i];
            m.disabled = !m.disabled;
            marker.setOpacity(m.disabled === true ? .3 : 1);           
        }


        // set all the markers on the map 
        function setMarkers() {

            // if markers exist, clear the array and remove from the map
            // prevents anomalies when repositioning existing markers if the marker array is out of sync with the scoped values
            if (gMapMarkers.length > 0) {
                var j, len = gMapMarkers.length;
                for (j = 0; j < len; j++) {
                    gMapMarkers[j].setMap(null);
                }
                gMapMarkers = [];
            }

            // add a marker for each value in scope, and store in the marker array
            var i, len = $scope.model.value.length;
            for (i = 0; i < len; i++) {

                var location = $scope.model.value[i],
                    latLng = new google.maps.LatLng(location.lat, location.lng);

                marker = new google.maps.Marker({
                    map: map,
                    position: latLng,
                    draggable: true,
                    title: location.name,
                    opacity: location.disabled === true ? .5 : 1
                });
                marker.umbMarkerId = i;
                marker.setMap(map);                    

                gMapMarkers.push(marker);
                
                addEventListeners();
                                
            }

        }

    });


angular.module('umbraco').directive("contenteditable", function () {
    return {
        require: "ngModel",
        link: function (scope, element, attrs, ngModel) {

            function read() {
                ngModel.$setViewValue(element.html());
            }

            ngModel.$render = function () {
                element.html(ngModel.$viewValue || "");
            };

            element.bind("blur keydown keypress", function (event) {
                if (event.type === 'blur') {
                    scope.$apply(read);
                }
                else if (event.which === 13 || event === 46) {
                    event.preventDefault();
                    scope.$apply(read);
                    element.blur();
                }
            });
        }
    };
});

angular.module('umbraco').filter("sentenceCase", function () {
    return function(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    };
});

angular.module('umbraco').filter('startFrom', function () {
    return function (input, start) {
        start = +start; //parse to int
        return input.slice(start);
    }
});



angular.module("umbraco").controller("uMap.DeleteDialogController", function ($scope, dialogService) {

    $scope.deleteDialogClick = function (t) {
        $scope.submit(t);
    }
});
