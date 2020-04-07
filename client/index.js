import createStore from './store';
import {
    loadMapboxAccessToken,
    loadMap,
    configureMap,
} from './components/map';
import generatePopup from './components/popup';

import 'mapbox-gl/dist/mapbox-gl.css';
import './style.scss';


function loadNTAGeodata() {
    // GeoJSON - "Feature" Format
    //
    // {
    //   "type": "Feature",
    //   "properties": {
    //     "ntacode": "BK88",
    //     "shape_area": "54005019.048",
    //     "county_fips": "047",
    //     "ntaname": "Borough Park",
    //     "shape_leng": "39247.2278309",
    //     "boro_name": "Brooklyn",
    //     "boro_code": "3"
    //   },
    //   "geometry": {
    //     "type": "MultiPolygon",
    //     "coordinates": [...]
    //   }
    // }
    return fetch('/data/nta.geojson')
        .then(response => response.json());
}

function loadGroups() {
    return fetch('/data/groups')
        .then(response => response.json())
        .then(groups => groups.map(group => Object.assign({}, group, {
            // Array of strings
            geoScope: JSON.parse(group.geoScope),
            // Array of foreign keys to "Ref - Neighborhood" table.
            neighborhoods: JSON.parse(group.neighborhoods),
        })));
}

function loadNeighborhoods() {
    return fetch('/data/neighborhoods')
        .then(response => response.json());
}

function transformNTAGeodata(ntaGeodata, store) {
    const allNeighborhoods = {
        type: 'FeatureCollection',
        features: [],
    };

    const neighborhoodsWithLocalGroups = {
        type: 'FeatureCollection',
        features: [],
    };

    const neighborhoodsWithoutLocalGroups = {
        type: 'FeatureCollection',
        features: [],
    };

    ntaGeodata.features.forEach((feature) => {
        const {
            ntacode: ntaCode,
            boro_name: boroName
        } = feature.properties;

        const neighborhood = store.ntaCodeToNeighborhood[ntaCode];

        if (neighborhood.hide) {
            return;
        }

        const properties = Object.assign({}, feature.properties, {
            // description: generatePopup(store, ntaCode, boroName)
        });

        feature.properties = properties;

        const hasLocalGroups = neighborhood.hasLocalGroups === 1;
        if (hasLocalGroups) {
            neighborhoodsWithLocalGroups.features.push(feature);
        } else {
            neighborhoodsWithoutLocalGroups.features.push(feature);
        }

        allNeighborhoods.features.push(feature);
    });

    return {
        allNeighborhoods,
        neighborhoodsWithLocalGroups,
        neighborhoodsWithoutLocalGroups,
    }
}

function loadGeodata() {
    return Promise.all([loadNeighborhoods(), loadNTAGeodata()])
        .then(([neighborhoods, ntaGeodata]) => {
            const store = createStore(neighborhoods);
            const geodata = transformNTAGeodata(ntaGeodata, store);
            return geodata;
        });
}

document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(document.location.search.substring(1));
    let fillOpacity = Number(params.get('opacity') || 1);
    if (isNaN(fillOpacity)) {
        fillOpacity = 1;
    }

    loadMapboxAccessToken()
        .then(() => Promise.all([loadMap('map'), loadGeodata()]))
        .then(([map, geodata]) => configureMap(map, geodata, fillOpacity));
});
