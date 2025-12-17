# things

1. Remove the following columns from the things list:

- Description
- Purchase Price
- DAte Added

2. Remove the Things at this Location list from the location page

3. In the things list can we display a small thumbnail of the first image associated with the thing

# Categories

1. The icons are not displaying correctly in the categories table. It's displayin the icon name.

2. Remove the color and icon text from under the description text in the table

# Inventories

1. When I click the settings button to manage inventories I get the following errors:
GET
https://f5jrvv9716.execute-api.us-east-1.amazonaws.com/dev/inventories/4157a8a8-d8d0-4e7f-b67d-1cf6dd674c04
CORS Missing Allow Origin

Cross-Origin Request Blocked: The Same Origin Policy disallows reading the remote resource at https://f5jrvv9716.execute-api.us-east-1.amazonaws.com/dev/inventories/4157a8a8-d8d0-4e7f-b67d-1cf6dd674c04. (Reason: CORS header ‘Access-Control-Allow-Origin’ missing). Status code: 404.

Network Error: No response received 
XMLHttpRequest { readyState: 4, timeout: 0, withCredentials: false, upload: XMLHttpRequestUpload, responseURL: "", status: 0, statusText: "", responseType: "", response: "", responseText: "" }
index-DryroXag.js:243:6515

2. When I click manage members I get the following error:

GET
https://f5jrvv9716.execute-api.us-east-1.amazonaws.com/dev/inventories/4157a8a8-d8d0-4e7f-b67d-1cf6dd674c04
CORS Missing Allow Origin

Cross-Origin Request Blocked: The Same Origin Policy disallows reading the remote resource at https://f5jrvv9716.execute-api.us-east-1.amazonaws.com/dev/inventories/4157a8a8-d8d0-4e7f-b67d-1cf6dd674c04. (Reason: CORS header ‘Access-Control-Allow-Origin’ missing). Status code: 404.

Network Error: No response received 
XMLHttpRequest { readyState: 4, timeout: 0, withCredentials: false, upload: XMLHttpRequestUpload, responseURL: "", status: 0, statusText: "", responseType: "", response: "", responseText: "" }
index-DryroXag.js:243:6515

3. When I add a new inventory it does not show up on the manage inventories page or in the list of inventories 


