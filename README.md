uMap
====

Simple Google Maps integration for Umbraco

uMap is a clean, simple mapping property editor for Umbraco 7.1+.

Property editor has two config values - the lat,lng values for the default location and a comma-separated list of additional data-points to store against each location (ie, you might want to record an email address or telephone number, if you're building a set of store locations). Both config values are optional.

For content editors, the property editor presents a familiar Google Map, on which they can drop new makers or reposition existing. Locations (and any additional fields for each) are tabulated below the map, with pagination and disable/delete options for each.

uMap uses the Google Maps API and the Places API to source data. At the Umbraco end, it's stored as a simple JSON object to make front-end display straightforward (especially if you use /Base to return said JSON via an AJAX request).

