// src/App.tsx

import React from 'react';
import Editor from './Editor.tsx';

export default function App() {
  return (
    <div>
      <Editor 
        initialCode={`#######################################################################
# USE IN ALL SCRIPT - Ensure print statements are flushed immediately
import functools
print = functools.partial(print, flush=True)
#######################################################################

import requests
import json
import os
import random
import math

import orekit
from orekit.pyhelpers import setup_orekit_curdir
from org.orekit.utils import Constants
from org.orekit.time import TimeScalesFactory
from org.orekit.propagation.analytical.tle import TLE, TLEPropagator
from org.orekit.orbits import CartesianOrbit
from org.orekit.frames import FramesFactory

from collections import defaultdict
from datetime import datetime
import itertools
from org.orekit.utils import PVCoordinates
from org.orekit.utils import TimeStampedPVCoordinates

# Initialize Orekit VM and set up data
vm = orekit.initVM()
# Update the path below to point to your Orekit data location
setup_orekit_curdir("/app/orekit-data.zip")

# Constants
ae = Constants.WGS84_EARTH_EQUATORIAL_RADIUS  # Earth's equatorial radius in meters
mu = Constants.WGS84_EARTH_MU  # Earth's gravitational parameter
utc = TimeScalesFactory.getUTC()

# Space-Track credentials (ensure these are set as environment variables)
SPACE_TRACK_USERNAME = "koxx33@gmail.com"
SPACE_TRACK_PASSWORD = "C6g42nVTNck7Me3qhBsZvr"

LOGIN_URL = "https://www.space-track.org/ajaxauth/login"
GP_HISTORY_URL = "https://www.space-track.org/basicspacedata/query/class/gp_history/NORAD_CAT_ID/{norad_id}/orderby/EPOCH%20desc/limit/50/format/json"

# Ensure print statements are flushed immediately
print = functools.partial(print, flush=True)

#======================#
# Function Definitions #
#======================#

def authenticate_space_track():
    """
    Authenticates with Space-Track using provided credentials.
    
    :return: Authenticated session or None if failed.
    """
    session = requests.Session()
    login_response = session.post(
        LOGIN_URL,
        data={"identity": SPACE_TRACK_USERNAME, "password": SPACE_TRACK_PASSWORD}
    )
    if login_response.status_code != 200:
        print(f"Failed to authenticate: {login_response.status_code}")
        return None
    print("Authenticated successfully with Space-Track.")
    return session

def fetch_gp_history(session, norad_id_list):
    """
    Fetches GP (General Perturbations) history for given NORAD IDs.
    
    :param session: Authenticated requests session.
    :param norad_id_list: List of NORAD IDs.
    :return: List of GP history records or None if failed.
    """
    norad_id_str = ",".join(map(str, norad_id_list))
    url = GP_HISTORY_URL.format(norad_id=norad_id_str)
    response = session.get(url)
    if response.status_code != 200:
        print(f"Failed to fetch GP history: {response.status_code}")
        return None
    try:
        gp_history = response.json()
    except json.JSONDecodeError:
        print("Failed to parse GP history JSON.")
        return None
    if not isinstance(gp_history, list):
        print("Unexpected GP history format.")
        return None
    gp_history = sorted(gp_history, key=lambda x: x["EPOCH"])
    print(f"Fetched GP history for NORAD IDs: {norad_id_str}")
    return gp_history

def tle_to_cartesian(tle_line1, tle_line2):
    """
    Converts TLE lines to a CartesianOrbit object.
    
    :param tle_line1: First line of the TLE.
    :param tle_line2: Second line of the TLE.
    :return: CartesianOrbit object.
    """
    tle = TLE(tle_line1, tle_line2)
    tleProp = TLEPropagator.selectExtrapolator(tle)
    absdateOd = tle.getDate()
    pv = tleProp.getPVCoordinates(absdateOd)
    initialOrbit = CartesianOrbit(pv, FramesFactory.getEME2000(), absdateOd, mu)
    return initialOrbit

def calculate_distance(pv1, pv2):
    """
    Calcule la distance entre deux satellites.
    
    :param pv1: PVCoordinates du premier satellite.
    :param pv2: PVCoordinates du deuxième satellite.
    :return: Distance en kilomètres.
    """
    dx = pv1.getPosition().getX() - pv2.getPosition().getX()
    dy = pv1.getPosition().getY() - pv2.getPosition().getY()
    dz = pv1.getPosition().getZ() - pv2.getPosition().getZ()
    distance = math.sqrt(dx*dx + dy*dy + dz*dz) / 1000  # Convertir en km
    return distance

def find_close_approaches(space_object_list, threshold_km=5.0):
    """
    Trouve les rapprochements entre satellites.
    
    :param space_object_list: Dictionnaire des objets spatiaux.
    :param threshold_km: Seuil de distance pour définir un rapprochement.
    :return: Liste de rapprochements avec les temps et les paires de satellites.
    """
    close_approaches = []
    
    # Obtenir toutes les paires de satellites
    satellite_pairs = list(itertools.combinations(space_object_list.values(), 2))
    
    for pair in satellite_pairs:
        sat1, sat2 = pair
        # Assumons que les PassList sont alignées temporellement
        for ephem1, ephem2 in zip(sat1["PassList"], sat2["PassList"]):
            for orbit1, orbit2 in zip(ephem1, ephem2):
                distance = calculate_distance(orbit1.getPVCoordinates(), orbit2.getPVCoordinates())
                
                # print("distance = ", distance, "threshold_km", threshold_km)
                # if distance <= threshold_km:
                approach_time = orbit1.getDate().toString()
                close_approaches.append({
                    "time": approach_time,
                    "satellite1": sat1["name"],
                    "satellite2": sat2["name"],
                    "distance_km": round(distance, 2)
                })
    
    # Trier par temps
    close_approaches.sort(key=lambda x: x["time"])
    print(f"Trouvés {len(close_approaches)} rapprochements entre les satellites.")
    return close_approaches


def create_space_object_list(gp_history):
    """
    Creates a dictionary of space objects from GP history.
    
    :param gp_history: List of GP history records.
    :return: Dictionary of space objects.
    """
    spaceObject_list = {}
    known_object_list = []

    for gp in gp_history:
        sat_name = gp.get("OBJECT_NAME", "Unknown")
        sat_id = gp.get("NORAD_CAT_ID")
        sat_cospar = gp.get("OBJECT_ID", "Unknown")
        sat_source = gp.get("ORIGINATOR", "Unknown")
        tle_line0 = gp.get("TLE_LINE0", "")
        tle_line1 = gp.get("TLE_LINE1", "")
        tle_line2 = gp.get("TLE_LINE2", "")
        
        if not (tle_line1 and tle_line2):
            print(f"Missing TLE lines for satellite {sat_id}. Skipping.")
            continue

        orbit = tle_to_cartesian(tle_line1, tle_line2)
        tle = (tle_line0, tle_line1, tle_line2)
        
        if sat_id in spaceObject_list:
            spaceObject_list[sat_id]["TleList"].append(tle)
            spaceObject_list[sat_id]["OrbitList"].append(orbit)
        else:
            known_object_list.append(sat_id)
            spaceObject_list[sat_id] = {
                "name": sat_name,
                "id": sat_id,
                "cospar": sat_cospar,
                "source": sat_source,
                "orbit_type": "",
                "last_orbital_data": {},
                "OrbitList": [orbit],
                "TleList": [tle],
                "PassList": []
            }

    # Classify orbit types and gather last orbital data
    for sat in spaceObject_list.values():
        last_tle = TLE(sat["TleList"][-1][1], sat["TleList"][-1][2])
        orbit = sat["OrbitList"][-1]
        sat_last_orbital_data = {
            "epoch": orbit.getDate().toString(),
            "sma": orbit.getA() / 1000,  # Convert meters to kilometers
            "ecc": orbit.getE(),
            "inc": math.degrees(orbit.getI())
        }
        
        sma = sat_last_orbital_data["sma"]
        ecc = sat_last_orbital_data["ecc"]
        inc = sat_last_orbital_data["inc"]

        if sma <= (2000 + ae / 1000):
            sat_orbit_type = "LEO"
        elif 2000 + ae / 1000 < sma <= 42164:
            if abs(inc) < 1:
                sat_orbit_type = "GEO"
            else:
                sat_orbit_type = "MEO"
        else:
            sat_orbit_type = "OTH"

        sat["orbit_type"] = sat_orbit_type
        sat["last_orbital_data"] = sat_last_orbital_data

    # Generate PassList with ephemerides
    for sat in spaceObject_list.values():
        OrbitList = sat["OrbitList"]
        for i, orbit in enumerate(OrbitList):
            if i != len(OrbitList) - 1:
                orbit_future = OrbitList[i + 1]
                date_orbit = orbit.getDate()
                date_orbit_future = orbit_future.getDate()
                delta_date_orbit = int(date_orbit_future.durationFrom(date_orbit))
            else:
                delta_date_orbit = 2 * 60 * 60  # 2 hours in seconds

            # Get corresponding TLE lines
            tle_line1 = sat["TleList"][i][1]
            tle_line2 = sat["TleList"][i][2]

            ephem = generate_cartesian_ephem(tle_line1, tle_line2, 0, delta_date_orbit, 10 * 60)
            sat["PassList"].append(ephem)

    print("Space object list created and orbits classified.")
    return spaceObject_list

def generate_cartesian_ephem(tle_line1, tle_line2, max_dt_before, max_dt_after, step):
    """
    Generates a list of CartesianOrbit objects representing an ephemeris.
    
    :param tle_line1: First line of the TLE.
    :param tle_line2: Second line of the TLE.
    :param max_dt_before: Seconds before the epoch to propagate.
    :param max_dt_after: Seconds after the epoch to propagate.
    :param step: Time step in seconds.
    :return: List of CartesianOrbit objects.
    """
    tle = TLE(tle_line1, tle_line2)
    keplProp = TLEPropagator.selectExtrapolator(tle)
    absdateOd = tle.getDate()
    ephem = []
    for dt in range(-max_dt_before, max_dt_after, step):
        ephem_pv_date = absdateOd.shiftedBy(float(dt))
        propagatedOrbit = keplProp.propagate(ephem_pv_date).getOrbit()
        cartesianOrbit = CartesianOrbit(propagatedOrbit)
        ephem.append(cartesianOrbit)
    return ephem

def generate_czml_txt(spaceObject_list, object_selected=False):
    """
    Generates the complete CZML data for all space objects.
    
    :param spaceObject_list: Dictionary containing all space objects.
    :param object_selected: List of selected NORAD IDs to display; if False, display all.
    :return: List representing the complete CZML data.
    """
    earliest_epoch, latest_epoch = get_czml_time_range(spaceObject_list)
    czml = [
        {
            "id": "document",
            "name": "Satellite Tracker",
            "version": "1.0",
            "clock": {
                "interval": earliest_epoch + "/" + latest_epoch,
                "currentTime": earliest_epoch,
                "multiplier": 60,
                "range": "LOOP_STOP",
                "step": "SYSTEM_CLOCK_MULTIPLIER"
            }
        }
    ]

    for spaceObject in spaceObject_list.values():
        display = False
        if not object_selected:
            display = True
        elif spaceObject["id"] in object_selected:
            display = True

        # Generate CZML packets for the space object
        czml_packets = generate_czml_SpaceObj(spaceObject, display)

        # Append the returned CZML packets to the main czml list
        if isinstance(czml_packets, list):
            czml.extend(czml_packets)
        elif isinstance(czml_packets, dict):
            czml.append(czml_packets)
        else:
            print(f"Unexpected CZML packet type for {spaceObject['name']}.")

    return czml

def get_czml_time_range(spaceObject_list):
    """
    Determines the earliest and latest epochs across all space objects.
    
    :param spaceObject_list: Dictionary containing all space objects.
    :return: Tuple of earliest and latest epoch strings.
    """
    if not spaceObject_list:
        # Default epoch range if no space objects are present
        return ("1970-01-01T00:00:00Z", "1970-01-01T00:00:00Z")

    # Initialize with the first space object's first and last orbit dates
    first_sat = next(iter(spaceObject_list.values()))
    earliest_epoch_date = first_sat["OrbitList"][0].getDate()
    latest_epoch_date = first_sat["OrbitList"][-1].getDate()
    
    for spaceObject in spaceObject_list.values():
        for ephem in spaceObject["PassList"]:
            if not ephem:
                continue
            min_epoch_date = ephem[0].getDate()
            max_epoch_date = ephem[-1].getDate()

            if min_epoch_date.isBefore(earliest_epoch_date):
                earliest_epoch_date = min_epoch_date
            if max_epoch_date.isAfter(latest_epoch_date):
                latest_epoch_date = max_epoch_date

    earliest_epoch = earliest_epoch_date.toString()
    latest_epoch = latest_epoch_date.toString()
    return (earliest_epoch, latest_epoch)

def generate_czml_SpaceObj(spaceObject, display=True):
    """
    Generates CZML packets for a given space object, including TCA markers if applicable.

    :param spaceObject: Dictionary containing space object data.
    :param display: Boolean indicating whether to display the object.
    :return: List of CZML dictionaries.
    """
    # Define earliest_epoch and latest_epoch for the current space object
    earliest_epoch, latest_epoch = get_czml_time_range({spaceObject["id"]: spaceObject})
    
    name = spaceObject["name"]
    identifier = "Satellite/" + name
    description_text_base = "Satellite infos: {name} ({norad_id} | {cospar}) from {source}"
    description_text = description_text_base.format(
        name=name,
        norad_id=spaceObject["id"],
        cospar=spaceObject["cospar"],
        source=spaceObject["source"]
    )
    description_text = "<p style='color: #000;'>" + description_text + "</p>"
    color = [random.randint(60, 255) for _ in range(3)] + [255]

    positions_with_time = []
    leadTime_list = [{"number": 60}]
    trailTime_list = [{"number": 120}]
    
    if display:
        leadTime_list = [{"number": 1800}]
        trailTime_list = [{"number": 3600}]

    for ephem in spaceObject["PassList"]:
        for elem in ephem:
            positions_with_time += [elem.getDate().toString()]
            positions_with_time += [elem.getPosition().x, elem.getPosition().y, elem.getPosition().z]
        if display:
            spaceObject_pass = generate_czml_pass(ephem)
            if spaceObject_pass:
                trailTime_list += [spaceObject_pass[0]]
                leadTime_list += [spaceObject_pass[1]]

    # Incorporate TCA Link (Assuming TCA is a specific event)
    # For demonstration, let's add a fixed billboard at the last position
    czml_tca = {}
    if display and positions_with_time:
        tca_position = positions_with_time[-3:]  # Last X, Y, Z
        czml_tca = {
            "id": identifier + "/TCA",
            "name": "Time of Closest Approach",
            "billboard": {
                "image": "https://path_to_red_marker_image.png",  # Replace with actual image URL or data URI
                "scale": 2.0,
                "show": True,
                "position": {
                    "cartesian": tca_position
                }
            },
            "label": {
                "text": "TCA",
                "fillColor": {"rgba": [255, 0, 0, 255]},
                "font": "14pt Lucida Console",
                "pixelOffset": {"cartesian2": [20, 0]},
                "show": True
            }
        }

    # Main CZML object for the space object
    object_czml = {
        "id": identifier,
        "name": name,
        "availability": earliest_epoch + "/" + latest_epoch,
        "description": description_text,
        "billboard": {
            "eyeOffset": {
                "cartesian": [0, 0, 0]
            },
            "horizontalOrigin": "CENTER",
            "image": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAADJSURBVDhPnZHRDcMgEEMZjVEYpaNklIzSEfLfD4qNnXAJSFWfhO7w2Zc0Tf9QG2rXrEzSUeZLOGm47WoH95x3Hl3jEgilvDgsOQUTqsNl68ezEwn1vae6lceSEEYvvWNT/Rxc4CXQNGadho1NXoJ+9iaqc2xi2xbt23PJCDIB6TQjOC6Bho/sDy3fBQT8PrVhibU7yBFcEPaRxOoeTwbwByCOYf9VGp1BYI1BA+EeHhmfzKbBoJEQwn1yzUZtyspIQUha85MpkNIXB7GizqDEECsAAAAASUVORK5CYII=",
            "pixelOffset": {
                "cartesian2": [0, 0]
            },
            "scale": 1.5,
            "show": display,
            "verticalOrigin": "CENTER"
        },
        "label": {
            "fillColor": {
                "rgba": color
            },
            "font": "11pt Lucida Console",
            "horizontalOrigin": "LEFT",
            "outlineColor": {
                "rgba": [0, 0, 0, 255]
            },
            "outlineWidth": 2,
            "pixelOffset": {
                "cartesian2": [12, 0]
            },
            "show": display,
            "style": "FILL_AND_OUTLINE",
            "text": name,
            "verticalOrigin": "CENTER"
        },
        "path": {
            "show": [
                {
                    "interval": earliest_epoch + "/" + latest_epoch,
                    "boolean": True
                }
            ],
            "width": 1,
            "material": {
                "solidColor": {
                    "color": {
                        "rgba": color
                    }
                }
            },
            "resolution": 240,
            "leadTime": leadTime_list,
            "trailTime": trailTime_list
        },
        "position": {
            "interpolationAlgorithm": "LAGRANGE",
            "interpolationDegree": 5,
            "referenceFrame": "INERTIAL",
            "epoch": earliest_epoch,
            "cartesian": positions_with_time
        }
    }

    # Return both object_czml and czml_tca as a list
    czml_packets = [object_czml]
    if display and czml_tca:
        czml_packets.append(czml_tca)

    return czml_packets

def generate_czml_pass(ephem):
    """
    Generates leadTime and trailTime for CZML path.

    :param ephem: List of CartesianOrbit objects representing an ephemeris.
    :return: List containing trailTime and leadTime dictionaries.
    """
    if not ephem:
        return False
    earliest_epoch = ephem[0].getDate()
    latest_epoch = ephem[-1].getDate()
    timedelta = int(latest_epoch.durationFrom(earliest_epoch))

    leadTime = {
        "interval": earliest_epoch.toString() + "/" + latest_epoch.toString(),
        "epoch": earliest_epoch.toString(),
        "number": [
            0, timedelta,
            timedelta, 0
        ]
    }

    trailTime = {
        "interval": earliest_epoch.toString() + "/" + latest_epoch.toString(),
        "epoch": earliest_epoch.toString(),
        "number": [
            0, 0,
            timedelta, timedelta
        ]
    }

    return [trailTime, leadTime]

def print_czml(czml_file):
    """
    Saves CZML data to 'czml.json'.
    
    :param czml_file: List representing the complete CZML data.
    """
    with open('czml.json', 'w') as json_file:
        json.dump(czml_file, json_file, indent=4)
    print("CZML data saved to 'czml.json'")
    return True

def generate_grid(space_object_list):
    """
    Generates grid data from space objects and saves to 'grid.json'.
    
    :param space_object_list: Dictionary containing all space objects.
    """
    grid_rows = []
    for sat in space_object_list.values():
        grid_rows.append({
            "name": sat["name"],
            "norad_id": sat["id"],
            "cospar": sat["cospar"],
            "orbit_type": sat["orbit_type"],
            "source": sat["source"],
            "epoch": sat["last_orbital_data"]["epoch"],
            "sma": sat["last_orbital_data"]["sma"],
            "ecc": sat["last_orbital_data"]["ecc"],
            "inc": sat["last_orbital_data"]["inc"]
        })

    grid_data = {
        "grid_columns": [
            {"field": "name", "headerName": "Name"},
            {"field": "norad_id", "headerName": "NORAD ID"},
            {"field": "cospar", "headerName": "COSPAR ID"},
            {"field": "orbit_type", "headerName": "Orbit Type"},
            {"field": "source", "headerName": "Source"},
            {"field": "epoch", "headerName": "Last Epoch"},
            {"field": "sma", "headerName": "Last SMA (km)"},
            {"field": "ecc", "headerName": "Last Eccentricity"},
            {"field": "inc", "headerName": "Last Inclination (°)"}
        ],
        "grid_rows": grid_rows
    }
    with open("grid.json", 'w') as f:
        json.dump(grid_data, f, indent=4)
    print("Grid data saved to 'grid.json'")

def process_selected_rows():
    """
    Processes selected rows from 'grid_selected_rows.json'.
    
    :return: List of selected NORAD IDs or False if file not found.
    """
    selected_rows_file = "grid_selected_rows.json"
    if not os.path.exists(selected_rows_file):
        print("No grid selected rows file found.")
        return False

    with open(selected_rows_file, 'r') as f:
        try:
            selected_rows = json.load(f)
        except json.JSONDecodeError:
            print("Failed to parse 'grid_selected_rows.json'.")
            return False

    print("Processing selected rows:")
    id_list = []
    for row in selected_rows:
        norad_id = row.get('norad_id', 'Unknown')
        name = row.get('name', 'Unknown')
        print(f"ID: {norad_id}, Name: {name}")
        id_list.append(norad_id)

    return id_list


def calculate_distances(space_object_list):
    """
    Calcule les distances entre toutes les paires de satellites à chaque instant.
    
    :param space_object_list: Dictionnaire des objets spatiaux.
    :return: Dictionnaire contenant les distances avec les temps pour chaque paire.
    """
    distances = defaultdict(list)
    
    # Obtenir toutes les paires de satellites
    satellite_pairs = list(itertools.combinations(space_object_list.values(), 2))
    
    for pair in satellite_pairs:
        sat1, sat2 = pair
        pair_identifier = f"{sat1['name']} - {sat2['name']}"
        
        # Assumons que les PassList sont alignées temporellement
        for ephem1, ephem2 in zip(sat1["PassList"], sat2["PassList"]):
            for orbit1, orbit2 in zip(ephem1, ephem2):
                distance = calculate_distance(orbit1.getPVCoordinates(), orbit2.getPVCoordinates())
                approach_time = orbit1.getDate().toString()
                distances[pair_identifier].append({
                    "x": approach_time,
                    "y": round(distance, 2)
                })
    
    print(f"Calculé les distances pour {len(distances)} paires de satellites.")
    return distances

def generate_line_chart_data(distances):
    """
    Génère les données pour un line chart montrant la distance entre les paires de satellites au fil du temps.
    
    :param distances: Dictionnaire contenant les distances avec les temps pour chaque paire.
    :return: Dictionnaire contenant les données du graph.
    """
    datasets = []
    colors = generate_unique_colors(len(distances))
    
    for idx, (pair, data_points) in enumerate(distances.items()):
        datasets.append({
            "label": pair,
            "data": data_points,
            "borderColor": colors[idx],
            "backgroundColor": colors[idx],
            "borderWidth": 2,
            "fill": False,
            "pointRadius": 1,
            "showLine": True
        })
    
    chart_data = {
        "datasets": datasets
    }
    
    # Définir les options du graphique
    chart_options = {
        "responsive": True,
        "maintainAspectRatio": False,
        "scales": {
            "x": {
                "type": "time",
                "time": {
                    "unit": "hour",
                    "tooltipFormat": "yyyy-MM-dd HH:mm:ss",
                    "displayFormats": {
                        "hour": "HH:mm"
                    }
                },
                "title": {
                    "display": True,
                    "text": "Temps (UTC)"
                }
            },
            "y": {
                "beginAtZero": True,
                "title": {
                    "display": True,
                    "text": "Distance (km)"
                }
            }
        },
        "plugins": {
            "legend": {
                "position": "top",
                "labels": {
                    "font": {
                        "size": 12
                    }
                }
            },
            "tooltip": {
                "enabled": True,
                "mode": "nearest",
                "intersect": False
            }
        },
        "interaction": {
            "mode": "nearest",
            "intersect": False
        },
        "animation": {
            "duration": 1000,
            "easing": "easeInOutQuad"
        },
        "title": {
            "display": True,
            "text": "Distance between sats"
        }
    }
    
    # Combiner en un seul objet
    line_chart = {
        "chart_data": chart_data,
        "chart_options": chart_options,
        "chart_type": "line",
    }
    
    return line_chart

def generate_unique_colors(n):
    """
    Génère une liste de couleurs RGB uniques.
    
    :param n: Nombre de couleurs à générer.
    :return: Liste de couleurs au format 'rgba(R, G, B, A)'.
    """
    colors = []
    for i in range(n):
        hue = i * (360 / n)
        saturation = 70 + random.randint(0, 10)  # 70-80%
        lightness = 50 + random.randint(0, 10)   # 50-60%
        color = f"hsla({hue}, {saturation}%, {lightness}%, 1)"
        colors.append(color)
    return colors
def generate_line_chart(space_object_list):
    """
    Génère un line chart pour les distances entre satellites.
    
    :param space_object_list: Dictionnaire contenant tous les objets spatiaux.
    """
    distances = calculate_distances(space_object_list)
    if not distances:
        print("Aucune distance calculée.")
        return False
    
    line_chart = generate_line_chart_data(distances)
    
    # Sauvegarder le line chart dans 'line_chart.json'
    with open('chart.json', 'w') as json_file:
        json.dump(line_chart, json_file, indent=4)
        
    # with open('json_file.json', 'w') as json_file:
    #     json.dump(line_chart, json_file, indent=4)
    
    print("Line chart data saved to 'line_chart.json'")
    return True


#==================#
#      Main        #
#==================#

if __name__ == "__main__":
    """
    Remaining Tasks:
    1. Implement Example CDM:
        - Collect 1 CDM for a NORAD ID.
        - Create a list with 2 Space Objects (OS), each containing a TLE.
        - Generate CZML with a fixed link to TCA in red and prominent.

    2. Clean the Code:
        - Remove unnecessary comments and imports.
        - Enhance code readability and structure.
    """
    # Authenticate with Space-Track
    session = authenticate_space_track()
    if not session:
        exit()

    # Définir la liste initiale des NORAD IDs
    norad_id_list = [25544, 40258, 37158, 42738, 42917, 42965]

    # Vérifier si des lignes sont sélectionnées dans le grid
    selected_rows = process_selected_rows()
    if selected_rows:
        # Extraire uniquement les 'norad_id' des lignes sélectionnées et les convertir en entiers
        try:
            print(f"selected_rows: {selected_rows}")
            norad_id_list = selected_rows
            print(f"Overridden NORAD ID list with selected rows: {norad_id_list}")
        except ValueError as ve:
            print(f"Erreur de conversion des NORAD IDs : {ve}")
            print("Utilisation de la liste NORAD ID par défaut.")
            norad_id_list = [25544, 40258, 37158, 42738, 42917, 42965]
    else:
        print(f"Using default NORAD IDs: {norad_id_list}")

    # Fetch GP history
    gp_history = fetch_gp_history(session, norad_id_list)
    if not gp_history:
        print("No GP history fetched.")
        exit()

    # Create space object list
    space_object_list = create_space_object_list(gp_history)

    # Process selected rows or generate grid
    selected_rows = process_selected_rows()
    if not selected_rows:
        generate_grid(space_object_list)
        selected_rows = []

    # Generate CZML data
    czml = generate_czml_txt(space_object_list, selected_rows)
    print_czml(czml)

    # Générer le Line Chart pour les rapprochements
    generate_line_chart(space_object_list)

    # Example: Adding a TCA Link (This assumes you have TCA data)
    # You need to define how to obtain TCA data for each satellite
    # and incorporate it into the CZML generation.

    # Example CDM Implementation (Assuming CDM is a maneuver or event)
    # You need to define how to fetch or define CDM data
    # and integrate it into the space_object_list and CZML.

    print("Script execution completed.")
`} 
        filePath="/workspace/editor1.py"
      />
       <Editor 
        initialCode={`print("Hello from Editor 2")\nvar2 = 123`} 
        filePath="/workspace/editor2.py"
      />
    </div>
  );
}
