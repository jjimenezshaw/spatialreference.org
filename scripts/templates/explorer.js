let _data = null;
let _map = null;
let _mapName = '';

function div(classes, appendTo, text, title, link) {
    let d = document.createElement('div');
    d.classList.add(...classes);
    if (appendTo) {
        appendTo.appendChild(d);
    }
    if (link) {
        let a = document.createElement('a');
        a.href = link;
        a.innerText = text;
        d.appendChild(a);
    }
    else if (text) {
        d.innerText = text;
    }
    if (title) {
        d.title = title;
    }
    return d;
}

function prepareFilterFromDoc() {
    let res = {
        types:{},
        allowDeprecated: true,
        ignoreWorld: false,
        authorities:{},
        map_box: null,
        str: '',
    };
    Array.from(document.querySelectorAll(".crstype")).forEach(t => {
        res.types[t.id] = t.checked;
    })
    Array.from(document.querySelectorAll(".crsauth")).forEach(t => {
        res.authorities[t.id] = t.checked;
    })
    res.allowDeprecated = document.getElementById('allowDeprecated').checked
    res.ignoreWorld = document.getElementById('ignoreWorld').checked
    res.map_box = makeMapBox(_map);
    res.str = document.querySelector('#activeSearchTxt').innerText;

    return res;
}

function intersects(box1, box2) {
    if (box1.n < box2.s || box2.n < box1.s) {
        return false;
    }

    if (box1.w <= box1.e && box2.w <= box2.e) {
        // none crosses the antimeridian
        return Math.max(box1.w, box2.w) <= Math.min(box1.e, box2.e);
    } else if (box1.w > box1.e && box2.w > box2.e) {
        // both cross the antimeridian
        return true;
    } else {
        // one crosses the antimeridian
        return box2.w <= box1.e || box1.w <= box2.e;
    }
}

function normalizeLong(lng) {
    while(lng < -180) {
        lng += 360;
    }
    while (lng > 180) {
        lng -= 360;
    }
    return lng;
}

function makeMapBox(map) {
    let markers = []
    map.eachLayer(function (layer) {
        if (layer instanceof L.Marker){
            markers.push(layer);
        }
    });
    if (!markers.length) return null;
    const latlng = markers[0].getLatLng();

    let w = latlng.lng;
    let e = w;
    let n = latlng.lat;
    let s = n;
    if (markers.length == 2) {
        const latlng2 = markers[1].getLatLng();
        w = Math.min(w, latlng2.lng);
        e = Math.max(e, latlng2.lng);
        n = Math.max(n, latlng2.lat);
        s = Math.min(s, latlng2.lat);
    }
    if (e-w >= 360) {
        w = -180;
        e = 180;
    } else {
        w = normalizeLong(w);
        e = normalizeLong(e);
    }
    const box = {w:w, s:s, e:e, n:n};
    return box;
}

function intersectsWithMapBox(map_box, area_of_use) {
    if (map_box) {
        const box2 = {w:area_of_use[0], s:area_of_use[1], e:area_of_use[2], n:area_of_use[3]};
        const use = intersects(map_box, box2);
        return use;
    }
    return true;
}

function validSearchStr(crs, str) {
    if (!str)
        return true;

    const crs_name = crs.name.toLowerCase();
    str = str.toLowerCase();
    const ors = str.match(/([^\|]+)/g);

    for (let i = 0; i < ors.length; i++) {
        const or = ors[i];
        const number = or.match(/^\s*([1-9]\d*)\s*$/);
        if (number && number.length == 2) {
            if (crs.code === number[1])
                return true;
        }
        const pieces = or.match(/(-?".*?"|[^"\s]+)(?=\s*|\s*$)/g);
        const valid_pieces = pieces.map(x => {
            let negate = false;
            if (x.charAt(0) == '-') {
                x = x.substring(1);
                negate = true;
            }
            x = x.replaceAll('"', '');
            return crs_name.includes(x) != negate;
        })
        const checker = valid_pieces.every(Boolean);
        if (checker)
            return true;
    }
    return false;
}

function runFilterCb() {
    if (!_data) return;
    const filters = prepareFilterFromDoc();
    let data = _data.filter(crs => {
        if (!filters.types[crs.type]) {
            return false;
        } else if (!filters.authorities[crs.auth_name]) {
            return false;
        } else if (!filters.allowDeprecated && crs.deprecated) {
            return false;
        } else if (filters.ignoreWorld && crs.area_of_use[0] == -180 && crs.area_of_use[2] == 180) {
            return false;
        } else if (!intersectsWithMapBox(filters.map_box, crs.area_of_use)) {
            return false;
        } else if (!validSearchStr(crs, filters.str)) {
            return false;
        }
        return true;
    })
    let count = fillTab(data);
    document.querySelector('.counter-text').innerText = count;
}

function slowTask(cb) {
    document.querySelector('.loader-text').classList.remove('hidden');
    document.querySelector('.counter-text').classList.add('hidden');
    setTimeout(function() {
        cb();
        document.querySelector('.loader-text').classList.add('hidden');
        document.querySelector('.counter-text').classList.remove('hidden');
        }, 0);
}


function makeTab() {
    let tab = div(['tab'])
    let header = div(['tab-line', 'tab-header'], tab);
    div(['tab-cell', 'tab-code'], header, 'Code');
    div(['tab-cell', 'tab-name'], header, 'Name');
    div(['tab-cell', 'tab-area'], header, 'Area of Use');
    div(['tab-cell', 'tab-type'], header, 'Type');
    div(['tab-cell', 'tab-deprecated'], header, 'Depr', 'Deprecated');
    return tab;
}

function fillTab(data) {
    let tab = document.querySelector('.tab');
    let tab_lines = document.querySelector('.tab-lines');
    if (tab_lines) {
        tab_lines.remove();
    }
    tab_lines = div(['tab-lines']);
    data.forEach(e => {
        let line = div(['tab-line'], tab_lines);
        const link = `./ref/${e.auth_name.toLowerCase()}/${e.code}`;
        const auth_code = `${e.auth_name}:${e.code}`;
        const area = e.area_of_use[4];
        div(['tab-cell', 'tab-code'], line, auth_code, auth_code, link);
        div(['tab-cell', 'tab-name'], line, e.name, e.name);
        div(['tab-cell', 'tab-area'], line, area, area);
        div(['tab-cell', 'tab-type'], line, type_abbr(e.type), e.type);
        div(['tab-cell', 'tab-deprecated'], line, e.deprecated ? 'D' : ' ');
    });
    tab.appendChild(tab_lines);
    return data.length;
}

function prepareCallbacks() {
    Array.from(document.querySelectorAll(
        '.crstype, .crsauth, #ignoreWorld, #allowDeprecated')).forEach(t =>
        t.addEventListener('change', function (ev) {
            runFilter();
    }));

    let form = document.querySelector("form");
    form.addEventListener("submit", function(event) {
        event.preventDefault();
        let str = form.elements.value.value;
        setSearchText(str)
        runFilter();
    });
}

function setLatlng(map, latlng, latlng2 = null) {
    function updateText(latlng1, latlng2) {
        let location = 'Clicked location: ' + latlng1;
        if (latlng2) location = 'Selected box: ' + latlng1 + ', ' + latlng2;
        document.querySelector('#location').innerHTML = location;
    }
    function addEvent(marker, other_marker, bounding_box) {
        marker.on('drag', function(ev) {
            bounding_box.setBounds(L.latLngBounds(other_marker.getLatLng(), ev.latlng))
            updateText(other_marker.getLatLng(), marker.getLatLng());
        });
        marker.on('dragend', function(ev) {
            updateText(other_marker.getLatLng(), marker.getLatLng());
            runFilter();
        })
    }

    let markers = []
    let bounding_boxes = []

    map.eachLayer(function (layer) {
        if (layer instanceof L.Marker){
            markers.push(layer);
        } else if (layer instanceof L.Polygon){
            bounding_boxes.push(layer);
        }
    });
    if (markers.length == 0) {
        const divCircle = L.divIcon({ className: 'circle'})
        function addSecondLatlng(ll) {
            markers.push(L.marker(ll, {icon: divCircle, draggable: true}).addTo(map));
            bounding_boxes.push(L.rectangle(L.latLngBounds(latlng, ll)).addTo(map));
            addEvent(markers[0], markers[1], bounding_boxes[0]);
            addEvent(markers[1], markers[0], bounding_boxes[0]);
        }
        markers.push(L.marker(latlng, {icon: divCircle, draggable: true}).addTo(map));
        if (latlng2) {
            // only on init from params
            addSecondLatlng(latlng2);
        } else {
            markers[0].once('dragstart', function(ev) {
                addSecondLatlng(ev.target.getLatLng());
            });
        }
    } else if (markers.length == 1) {
        markers[0].setLatLng(latlng);
    } else if (markers.length >= 2) {
        markers.forEach(e => e.removeFrom(map));
        bounding_boxes.forEach(e => e.removeFrom(map));
        return setLatlng(map, latlng);
    }
    updateText(latlng, latlng2);
    runFilter();
}

function makeMap(mapName) {
    let map = L.map('mapid').setView([0, 0], 1);
    let osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 18,
    });
    let osmde = L.tileLayer('https://tile.openstreetmap.de/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 18,
    });
    let carto = L.tileLayer('https://cartodb-basemaps-{s}.global.ssl.fastly.net/rastertiles/voyager/{z}/{x}/{y}.png', {
        attribution: '&copy; Carto, under CC BY 3.0. Data by OpenStreetMap, under ODbL.',
        maxZoom: 18,
    });
    let baseMaps = {
        "OSM": osm,
        "OSM (de)": osmde,
        "Carto (en)": carto
    };
    _mapName = mapName;
    switch(mapName) {
        case 'osmde':
            osmde.addTo(map);
            break;
        case 'carto':
            carto.addTo(map);
            break;
        default:
            osm.addTo(map);
    }
    L.control.layers(baseMaps).addTo(map);

    document.querySelector('#stickyCb').addEventListener('click', function (ev) {
        document.querySelector('#mapcont').classList[ev.target.checked ? 'add' : 'remove']('sticky');
    });

    map.on('click', function(e) {
        setLatlng(map, e.latlng)
    });

    map.on('baselayerchange', ev => {
        _mapName = '';
        switch(L.stamp(ev.layer)) {
            case L.stamp(osm):
                _mapName = 'osm';
                break;
            case L.stamp(osmde):
                _mapName = 'osmde';
                break;
            case L.stamp(carto):
                _mapName = 'carto';
                break;
        }
        updateURL()
    });

    document.querySelector('#delete').addEventListener('click', function () {
        let doit = false;
        map.eachLayer(function (layer) {
            if (layer instanceof L.Marker || layer instanceof L.Polygon){
                layer.removeFrom(map);
                doit = true;
            }
        });

        if (doit) {
            document.querySelector('#location').innerHTML = '';
            runFilter();
        }
    });

    return map;
}

function toggleInfo() {
    document.querySelector("#search_info").classList.toggle('hidden');
}

function emptyParams() {
    let dic = {
        latlng : '',
        searchText : '',
        ignoreWorld : 'false',
        allowDeprecated : 'false',
        authorities : '',
        activeTypes: '',
    };
    return dic;
}

function mapBoxToLatlngStr(map_box) {
    let res = '';
    if (!map_box)
        return res;
    res = map_box.n.toFixed(6) + ',' + map_box.e.toFixed(6);
    if (map_box.n !== map_box.s || map_box.w !== map_box.e) {
        res += ',' + map_box.s.toFixed(6) + ',' + map_box.w.toFixed(6);
    }
    return res;
}

function paramsFromDocument() {
    function toStrWithCommas(obj) {
        return Object.entries(obj).filter(([k,v]) => v).map(([k,v]) => k).join(',');
    }
    const filter = prepareFilterFromDoc()
    let params = emptyParams();
    params.latlng = mapBoxToLatlngStr(filter.map_box);
    params.searchText = filter.str;
    params.ignoreWorld = filter.ignoreWorld.toString();
    params.allowDeprecated = filter.allowDeprecated.toString();
    params.authorities = toStrWithCommas(filter.authorities);
    params.activeTypes = toStrWithCommas(filter.types);
    return params;
}

function updateFiltersFromParams(input) {

    function getAttribute(selector, attr) {
        return Array.from(document.querySelectorAll(selector)).map(e => e.getAttribute(attr))
    }

    let dic = emptyParams();
    dic.authorities = 'EPSG'; // default enabled

    if (input.all == 'true') {
        dic.ignoreWorld = 'false';
        dic.allowDeprecated = 'true';
        dic.authorities = getAttribute('.crstype', 'id').join(',');
        dic.activeTypes = getAttribute('.crsauth', 'id').join(',');
    }

    Object.assign(dic, input);

    function setCheck(id, checked) {
        let obj = document.getElementById(id);
        if (!obj) return;
        if (checked) {
            obj.setAttribute('checked', '');
        } else {
            obj.removeAttribute('checked');
        }
    }

    try {
        const latlng = dic.latlng.split(',');
        if (latlng.length == 4) setLatlng(_map, L.latLng(latlng.slice(0,2)), L.latLng(latlng.slice(2,4)));
        else if (latlng.length >= 2) setLatlng(_map, L.latLng(latlng.slice(0,2)));
    } catch (ignore) {}

    setSearchText(decodeURIComponent(dic.searchText))

    dic.authorities.split(',').forEach(auth => {
        setCheck(auth, true);
    });

    dic.activeTypes.split(',').forEach(type => {
        setCheck(type, true);
    });

    setCheck('ignoreWorld', dic.ignoreWorld == 'true');
    setCheck('allowDeprecated', dic.allowDeprecated == 'true');
}

function querystringFromFilters(mapName) {
    let params = paramsFromDocument();
    params.searchText = encodeURIComponent(params.searchText);
    if (mapName) params.map = mapName;
    if (!params.latlng) delete params.latlng;
    if (!params.searchText) delete params.searchText;
    let res = Object.keys(params).map(key => key +'='+ params[key]).join('&');
    return res;
}

let _runCounter = 0;
function updateURL() {
    let url = new URL(location);
    url.search = querystringFromFilters(_mapName);
    if (_runCounter == 0) {
    } else if (_runCounter == 1) {
        window.history.pushState(null, '', url.toString());
    } else {
        window.history.replaceState(null, '', url.toString());
    }
    _runCounter++;
}

function runFilter() {
    updateURL();
    slowTask(runFilterCb);
}

function setSearchText(str) {
    let form = document.querySelector("form");
    form.elements.value.value = str;
    str = str.trim();

    document.querySelector('#activeSearchTxt').innerText = str;
    if (str) {
        document.querySelector('#activeSearch').classList.remove('hidden');

    } else {
        document.querySelector('#activeSearch').classList.add('hidden');
    }
}

function prepareDoc() {
    const params = paramsToDic(window.location);
    _map = makeMap(params.map);
    updateFiltersFromParams(params)
    prepareCallbacks();
}

function paramsToDic(location) {
    const url = new URL(location);
    let dic = {};
    for (let k of url.searchParams.keys()) {
        dic[k] = url.searchParams.get(k);
    }
    return dic;
}

function init_explorer(home_dir) {
    prepareDoc();
    fetch(home_dir + '/crslist.json', {
        method: "GET",
    })
    .then(response => response.json())
    .then(d => {
        _data = d;
        const tab = makeTab();
        document.getElementById('tab-container').appendChild(tab);
        runFilter();
    })
}