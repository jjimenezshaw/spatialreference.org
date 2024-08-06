let _data = null;
let _map = null;

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

function prepare_filter() {
    let res = {
        types:{},
        allowDeprecated: true,
        ignoreWorld: false,
        authorities:{},
    };
    Array.from(document.querySelectorAll(".crstype")).forEach(t => {
        res.types[t.id] = t.checked;
    })
    Array.from(document.querySelectorAll(".crsauth")).forEach(t => {
        res.authorities[t.id] = t.checked;
    })
    res.allowDeprecated = document.getElementById('allowDeprecated').checked
    res.ignoreWorld = document.getElementById('ignoreWorld').checked
    return res;
}

function run_filter() {
    const filters = prepare_filter();
    let data = _data.filter(crs => {
        if (!filters.types[crs.type]) {
            return false;
        } else if (!filters.authorities[crs.auth_name]) {
            return false;
        } else if (!filters.allowDeprecated && crs.deprecated) {
            return false;
        } else if (filters.ignoreWorld && crs.area_of_use[0] == -180 && crs.area_of_use[2] == 180) {
            return false;
        }
        return true;
    })
    let count = fill_tab(data);
    document.querySelector('.counter-text').innerText = count;
}

function slow_task(cb) {
    document.querySelector('.loader-text').classList.remove('hidden');
    document.querySelector('.counter-text').classList.add('hidden');
    setTimeout(function() {
        cb();
        document.querySelector('.loader-text').classList.add('hidden');
        document.querySelector('.counter-text').classList.remove('hidden');
        }, 0);
}


function make_tab() {
    let tab = div(['tab'])
    let header = div(['tab-line', 'tab-header'], tab);
    div(['tab-cell', 'tab-code'], header, 'Code');
    div(['tab-cell', 'tab-name'], header, 'Name');
    div(['tab-cell', 'tab-area'], header, 'Area of Use');
    div(['tab-cell', 'tab-type'], header, 'Type');
    div(['tab-cell', 'tab-deprecated'], header, 'Depr', 'Deprecated');
    return tab;
}

function fill_tab(data) {
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

function prepare_callbacks() {
    Array.from(document.querySelectorAll(
        '.crstype, .crsauth, #ignoreWorld, #allowDeprecated')).forEach(t =>
        t.addEventListener('change', function (ev) {
            slow_task(run_filter);
    }));
}

function set_latlng(map, latlng, latlng2 = null) {
    function update_text(latlng1, latlng2) {
        let location = 'Clicked location: ' + latlng1;
        if (latlng2) location = 'Selected box: ' + latlng1 + ', ' + latlng2;
        document.querySelector('#location').innerHTML = location;
    }
    function add_event(marker, other_marker, bounding_box) {
        marker.on('drag', function(ev) {
            bounding_box.setBounds(L.latLngBounds(other_marker.getLatLng(), ev.latlng))
            update_text(other_marker.getLatLng(), marker.getLatLng());
        });
        marker.on('dragend', function(ev) {
            update_text(other_marker.getLatLng(), marker.getLatLng());
            slow_task(run_filter);
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
        markers.push(L.marker(latlng, {icon: divCircle, draggable: true}).addTo(map));
        markers[0].once('dragstart', function(ev) {
            const ll = ev.target.getLatLng();
            markers.push(L.marker(ll, {icon: divCircle, draggable: true}).addTo(map));
            bounding_boxes.push(L.rectangle(L.latLngBounds(ll, ll)).addTo(map));
            add_event(markers[0], markers[1], bounding_boxes[0]);
            add_event(markers[1], markers[0], bounding_boxes[0]);
        });
    } else if (markers.length == 1) {
        markers[0].setLatLng(latlng);
    } else if (markers.length >= 2) {
        markers.forEach(e => e.removeFrom(map));
        bounding_boxes.forEach(e => e.removeFrom(map));
        return set_latlng(map, latlng);
    }
    update_text(latlng);
    slow_task(run_filter);
}

function make_map() {
    let map = L.map('mapid').setView([0, 0], 1);
    let osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 18,
    }).addTo(map);
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
    L.control.layers(baseMaps).addTo(map);

    document.querySelector('#stickyCb').addEventListener('click', function (ev) {
        document.querySelector('#mapcont').classList[ev.target.checked ? 'add' : 'remove']('sticky');
    });

    map.on('click', function(e) {
        set_latlng(map, e.latlng)
    });

    return map;
}
function init_explorer(home_dir) {
    prepare_callbacks();
    _map = make_map();
    fetch(home_dir + '/crslist.json', {
        method: "GET",
    })
    .then(response => response.json())
    .then(d => {
        _data = d;
        const tab = make_tab();
        document.getElementById('tab-container').appendChild(tab);
        slow_task(run_filter);
    })
}