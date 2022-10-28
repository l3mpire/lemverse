<div align="center">

# lemverse<br>

[![Discord](https://badgen.net/badge/icon/discord?icon=discord&label)](https://discord.gg/uMfZf6T7)
[![GitHub release](https://img.shields.io/github/v/release/l3mpire/lemverse.svg)](https://GitHub.com/l3mpire/lemverse/releases/)
[![Open Source? Yes!](https://badgen.net/badge/Open%20Source%20%3F/Yes%21/blue?icon=github)](https://github.com/l3mpire/lemverse)
[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)

  <img alt="lemverse" src="./app/public/lemverse.png" width="128" height="128" style="margin-top: 10px;">

</div>

# Table of contents

- [What is `lemverse`?](#what-is-lemverse)
- [What can I do in lemverse?](#what-can-i-do-in-lemverse)
- [Getting started!](#getting-started)
- [Deploy in production!](#deploy-in-production)
- [Useful commands/tricks](#useful-commandstricks)
- [Assets](#assets)
- [Star History](#star-history)
- [License](#license)
- [Credits](#credits)
- [Screenshots](#screenshots)

# What is `lemverse`?

- Want to talk with your remote colleagues/friends?
- Want to have the office you have ever dreamt of?
- Want to friendly get in touch with people without messaging them?
- Want to hold virtual conference?
- Want to walk inside your own coworking office?
- Want to try something new?

If you have answer `yes` to one of those questions, then `lemverse` is for you!  
You can either launch it locally, on a server or join us at [lemverse.com](https://lemverse.com).

> ℹ️ Can't wait to install lemverse? You can go directly to the [Getting started](#getting-started) section  
> :warning: For the moment we only focus on compatibility with the Chrome browser

# What can I do in lemverse?

## Tileset Editor

In order to be able to create your own universe, you will need some tilesets.  
We recommend using tileset of 16x16 pixels.

To upload a new tileset, visit the url `http://localhost:3000/editor` or `http://lemverse.example.com/editor`.
ℹ️ Only people with `admin` role can access this page.

Here are the description of all parts:  
<img alt="login" src="./app/public/tileset-editor.png">

1. As stated, you drag and drop your image file(s) to upload them.
2. This part is just a reminder about the index of the layers for all tiles.
  - Player are between layer `5` and `6`.
  - Default index is `2` and not displayed.
3. This is the list of all tilesets.
  - You can either remove the tileset with hitting the cross
  - Rename it, by double clicking on it
4. The view of the tileset
  - When you are over a tile, simply hit a number from `0` to `8` to change the layer
  - Layer `2` is the default and thus is not displayed
  - Hit `c` to change the tile to be a collision tile (will be displayed in red)

Once you have imported the tileset and do some tweak about collision and layering, you can begin to create your universe!

## Character Editor

This editor takes place at the same place as the tilesets editor.

To add a new resource, simply drag & drop over the page.

Here are the description of all parts:  
<img alt="login" src="./app/public/character-editor.png">

1. Different type of filter to change the dropdown
2. Here are the list of all resources available in the current category
3. Display of the character part to help you figure out how to categorize it.
4. The five possible categories to change the part.

## Edit your universe!

For editing the universe you need to have the right to do so. Luckily for you, outside of production anybody can do it!

To move to the editor mode, simply it `e` and you should see it!

### Level edit

Once you hit `e` you will see something like this:  
<img alt="login" src="./app/public/level-editor.png">

Here are the description of all parts:

1. All tiles that you can select. Move your mouse over them and click to select.
  - Once it's done, you can click on the map to paste it.
  - You can also select multiple tiles at the same time!
2. You did mess up and want to clean up things?
  - You can hit `cmd+z` to undo what you just did.
  - Or use the `eraser` tool to remove one layer (shortcut from `0` to `8`) or hit `c` to remove all layers upon selection.
3. It's the dropdown of all your tilesets. You can select another one to be able to copy/paste others tiles.
4. Information about your current pointer on map.
  - You have the position
  - Information about the different tiles on each layers (useful to use the right `eraser` layer)

### Zone edit

Once you hit `e` again you will see something like this:  
<img alt="login" src="./app/public/zone-editor.png">

You can add a zone then select on the map the top left followed by the bottom right corner of the new zone.

If you want to edit a zone, simply click on either corner coordinate then click on the map.

> ℹ️ Press "alt" or "option" during edition to snap world coordinates to tiles coordinates

Each zone can be configured to make more things.  
To edit those information, simply click on the name of the room (bold text).

```jsonc
{
  "adminOnly": false|true, // Put true to restrict the zone to administrators
  "name": "PianoSession", // Name displayed when you enter in the zone
  "hideName": false|true, // Shows/hides the name of the zone when the user enters it
  "roomName": "", // Open a jitsi room with the given name, leave empty to do nothing
  "teleportEndpoint": "", // Coordinate "640,480" where unauthorized people will be teleported once enter restricted zone
  "unmute": false|true, // Automatically unmute jitsi mic (useful to unmute people on platform in conference room)
  "unhide": false|true, // Automatically show cam in jitsi (useful to show people face automatically on platform in conference room)
  "url": "https://mczak.com/code/piano/pianoframe", // If present, this will popup an iframe with this url inside
  "fullscreen": false|true, // Set the iframe if full screen or not
  "targetedLevelId": "", // Used for teleport zone. Should be the id of the level to teleport to.,
  "inlineURL": "https://status.lemlist.com|<p>My custom text</p>", // Pop-in content with URL or HTML content
  "disableCommunications": false|true, // Disabling all communications for the user inside the zone
  "yt": false|true, // If the "url" attribute is a YouTube video it allows its integration without blocking
  "requiredItems": ["itm_x", "itm_y"], // Items required to enter the zone
  "spawn": false|true, // Mark this zone as the starting zone, users will be able to enter the level from here
  "popInConfiguration": {
    "position": "top", // Optional: Pop-in position on the zone (center, left, right, bottom or top), set "relative" for custom position using "x" & "y" (default center)
    "x": 0, // Optional: Relative position from the zone's center on X (you need to set "position" to "relative")
    "y": -60, // Optional: Relative position from the zone's center on Y (you need to set "position" to "relative")
    "width": 120, // Optional: Custom width
    "height": 45, // Optional: Custom height
    "className": "wood-style welcome with-arrow tooltip acid fade-in animated-text" // Optional: List of CSS classes to customize pop-in's style
  }
}
```

### Entity edit

An entity is something dynamic outside the map that can be interacted with and animated unlike the world map.

It is possible to do many things with it like :

- Create doors
- Add unique/customized elements
- Create interactions
- ...

For game developers, an entity should be seen as a simple identifier on which components are added.

For the moment it is possible to create entities only from a JSON configuration, some parameters can be modified directly with an interface.

Here is the structure of a basic JSON for a door:

```jsonc
{
  // Main data
  "_id": "ent_x",
  "name": "Door",
  "levelId": "lvl_z",
  "x": 0,
  "y": 0,

  // 0 = no action / 1 = actionable / 2 = pickable (will be stored in the user inventory)
  "actionType": 0,

  // optional: Linked entity, useful to create triggers
  "entityId": "ent_y",

  // States available (optional)
  "state": "off",
  "states": {
    "off": {
      "animation": "close", // animation to play when entering this state
      "collider": {
        "enable": true // enable the collider
      }
    },
    "on": {
      "animation": "open",
      "collider": {
        "enable": false
      }
    }
  },

  // Entity representation in the simulation (optional)
  "gameObject": {
    "scale": 1,

    // Sprite component (optional)
    "sprite": {
      "key": "image_unique_id",
      "path": "image_url|sprite_sheet_url",
      "frameWidth": 32, // optional: set frame width on the spritesheet
      "frameHeight": 48 // optional: set frame height on the spritesheet
    },

    // Animation component (optional)
    "animations": {
      "open": {
        "repeat": 0,
        "start": 0,
        "end": 5
      },
      "close": {
        "repeat": 0, // -1 to animate endlessly, 0 to animate once, x to animate x times
        "start": 5, // starting animation on the
        "end": 0 // ending frame
      }
    },

    // Physics component (optional)
    "collider": {
      "radius": 15, // use "radius" to create a circle. Use "width" and "height" to create a rectangle
      "offsetX": -15, // collider offset on X
      "offsetY": -30, // collider offset on Y
      "immovable": false, // static or dynamic physic body
      "dragX": 0.05, // drag on x = "friction"/velocity slowdown speed
      "dragY": 0.05, // drag on y = "friction"/velocity slowdown speed
      "collideTilemap": true // enable or disable collision with walls
    }
  }
}
```

## Shortcuts in lemverse

In lemverse you have only few but useful shortcuts!

### Who's here and where?

What to know more about the `explorers` in the same universe?  
Hit `Tab` and you will see them! And maybe ghosts...

<img alt="login" src="./app/public/tab.png">

Only `admin` can see others admin (with the 👑).  
You can allow other users to edit your universe by clicking on the hammer and spanner 🛠.

### Reactions

If you want to use pre-defined reactions, you can hit from `1` to `5` and it will display an emoji on top of your character.  
If you want to use a custom one, go to the settings to add one, and use `l` to activate it!

### Share what you want!

Activating camera, sharing screen can be annoying with the mouse itself, so simply use `shift`+`1` (to `4`) to switch the state of the options.

### Editing the level

Like describe in a previous part, we must use `e` to launch the edit mode.

### Shout to your surrounding!

Like in real life, you can shout around you.  
We restricted this to the zone you are currently in.

To do so, simply hit `r` and speak!  
Once you finished, just release the touch and your message will be send to everybody and play instantly.

### Leave a message!

It may happen that a user isn't available to chat. Fortunately, it's possible to leave a message for the user.

The use is very simple, you just have to go near the person to whom you want to leave a message and then press the `p` key, speak and release the key.

The user will then receive a notification.
You can also open your notification list and listen to old messages using `cmd/ctrl + 5`.

## How to create a new universe?

To create a new universe you need to add a document in the `levels` collection.

Simply run the following command in your browser console:

```js
Levels.insert({ _id: Levels.id(), name: "My test universe" });
```

For the `level` structure, here are an explanation of all fields:

```jsonc
{
  "_id": "lvl_XXXXXXXX", // Id of the level (useful for TP)
  "name": "My test universe", // Name of your universe
  "spawn": {
    // Spawn position in level
    "x": 42,
    "y": 7
  },
  "skins": {
    "guest": {
      // Guest Avatar
      "body": "chr_11111111111111111", // Id "characters" collection
      "accessory": "chr_22222222222222222", // Id in "characters" collection (Optional)
      "hair": "chr_33333333333333333", // Id in "characters" collection
      "eye": "chr_44444444444444444", // Id in "characters" collection
      "outfit": "chr_55555555555555555" // Id in "characters" collection
    },
    "default": {
      // Default Avatar when user create account
      "body": "chr_11111111111111111", // Id "characters" collection
      "accessory": "chr_22222222222222222", // Id in "characters" collection (Optional)
      "hair": "chr_33333333333333333", // Id in "characters" collection
      "eye": "chr_44444444444444444", // Id in "characters" collection
      "outfit": "chr_55555555555555555" // Id in "characters" collection
    }
  }
}
```

You can use the level id everywhere it's useful, like in the `defaultLevelId` property in `settings.json` (More information bellow).

## Tell me more about `settings.json`!

This file regroup all information about the settings.  
Please note, that as stated in section `Deploy in production`, there is an additional file with sensitive information that will me merge with the one in the repository.

ℹ️ It's better to copy the file `_settings.json` available in the app folder instead of copying the excerpt below

<details>
  <summary>Click to toggle contents of _settings.json</summary>
  <p>

```jsonc
{
  "public": {
    "lp": {
      "product": "lemverse",
      "process": "main",
      "helpURL": "https://lempire.notion.site/lempire/lemverse-Fire-Escape-920063782c4243f69d85ed0a4f65cac3",
      "gods": [], // List of gods (can use remote command) like "usr_11111111111111111"
      "production": true,
      "staging": false,
      "enableLogClient": false
    },

    "debug": false,

    "defaultReaction": "❤️",

    "zoom": {
      "default": 1, // Default zoom level
      "min": 0.6, // Minimum zoom level
      "max": 1.6, // Maximum zoom level
      "factor": 0.001, // Zoom factor (increase to zoom faster, decrease to zoom slower)
      "maxDelta": 100, // Maximum zooming delta
      "pinchDelta": 4 // Delta zoom on mobile pinch
    },

    "peer": {
      // Settings about webrtc connection
      "answerMaxAttempt": 5,
      "answerDelayBetweenAttempt": 750,
      "avatarAPI": "https://source.unsplash.com/320x240/?cat&sig=[user_id]", // Avatar when users do not share their camera
      "callDelay": 250, // Delay before a call is started, useful to avoid a call when you pass by someone
      "delayBeforeClosingCall": 1000,
      "sounds": {
        "hangUp": {
          "file": "webrtc-out.mp3",
          "volume": 0.2
        },
        "incomingCall": {
          "file": "webrtc-in.mp3",
          "volume": 0.2
        }
      }
    },

    "meet": {
      // Jitsi settings
      "serverURL": "meet.jit.si",
      "roomDefaultName": "lemverse"
    },

    "character": {
      // Settings to handle velocity of the character
      "walkSpeed": 180,
      "runSpeed": 720,
      "sensorNearDistance": 75, // Distance required before starting a call with an user
      "sensorFarDistance": 85, // Distance required before closing a call with an user
      "nameColors": { // Colors available for user name (shown in the dropdown list in the user profile), if not provided a color picker is displayed
        "white": ["0xffffff", "0xffffff", "0xffffff", "0xffffff"], // A color gradient is set using the following order: [topLeft, topRight, bottomLeft, bottomRight]
        "orange": ["0xfc9729", "0xfc9729", "0xf69831", "0xf69831"],
        "red": ["0xf15739", "0xf15739", "0xee5c3b", "0xee5c3b"],
        "yellow": ["0xf4c918", "0xf4c918", "0xdbb92a", "0xdbb92a"],
        "beige": ["0xedc993", "0xedc993", "0xe5bf8a", "0xe5bf8a"],
        "green": ["0xabdf3a", "0xabdf3a", "0xa1cb44", "0xa1cb44"],
        "lightGreen": ["0x52d8a2", "0x52d8a2", "0x57cfa0", "0x57cfa0"],
        "blue": ["0x2394d9", "0x2394d9", "0x3199da", "0x3199da"],
        "lightBlue": ["0xa4e2fb", "0xa4e2fb", "0xa5dbf0", "0xa5dbf0"],
        "pink": ["0xe584e1", "0xe584e1", "0xf291f0", "0xf291f0"],
        "purple": ["0xb558e1", "0xb558e1", "0xfa8ff8", "0xfa8ff8"]
      }
    },

    "permissions": {
      "allowAccountCreation": "all", // all for everyone, none for no-one, except:lvl_xxx to block a level
      "allowLevelCreation": true,
      "allowProfileEdition": true, // Shows 'My account' tab in the user settings menu
      "contactURL": ""
    },

    "passwordless": false, // Activate to use magic link emails instead of password for log-in

    "assets": {
      // Assets configuration
      "character": {
        "frameWidth": 16,
        "frameHeight": 32,
        "formats": {
          "w-384": {
            // Modern interiors: old format
            "animations": {
              "run": {
                "up": {
                  "frames": [54, 55, 56, 57, 58, 59],
                  "frameRate": 10,
                  "repeat": -1
                },
                "down": {
                  "frames": [66, 67, 68, 69, 70, 71],
                  "frameRate": 10,
                  "repeat": -1
                },
                "left": {
                  "frames": [60, 61, 62, 63, 64, 65],
                  "frameRate": 10,
                  "repeat": -1
                },
                "right": {
                  "frames": [48, 49, 50, 51, 52, 53],
                  "frameRate": 10,
                  "repeat": -1
                }
              }
            }
          },
          "w-927": {
            // Modern interiors: new format
            "animations": {
              "run": {
                "up": {
                  "frames": [120, 121, 122, 123, 124, 125],
                  "frameRate": 10,
                  "repeat": -1
                },
                "down": {
                  "frames": [132, 133, 134, 135, 136, 137],
                  "frameRate": 10,
                  "repeat": -1
                },
                "left": {
                  "frames": [126, 127, 128, 129, 130, 131],
                  "frameRate": 10,
                  "repeat": -1
                },
                "right": {
                  "frames": [114, 115, 116, 117, 118, 119],
                  "frameRate": 10,
                  "repeat": -1
                }
              }
            }
          }
        },
        "w-896": {
          // Modern interiors: new format (for hairs, eyes, outfits, …)
          "animations": {
            "run": {
              "up": {
                "frames": [118, 119, 120, 121, 122, 123],
                "frameRate": 10,
                "repeat": -1
              },
              "down": {
                "frames": [130, 131, 132, 133, 134, 135],
                "frameRate": 10,
                "repeat": -1
              },
              "left": {
                "frames": [124, 125, 126, 127, 128, 129],
                "frameRate": 10,
                "repeat": -1
              },
              "right": {
                "frames": [112, 113, 114, 115, 116, 117],
                "frameRate": 10,
                "repeat": -1
              }
            }
          }
        }
      }
    },

    "skins": {
      // Default skins (can be defined at level)
      "guest": {
        "body": "chr_H2ARGyiKd8wQ4hQcr"
      },
      "default": {
        "body": "chr_2HARGyiKf8wQ8hQcr"
      }
    },

    "tos": {
      "terms": "",
      "cookies": "",
      "privacy": ""
    }
  },

  "forbiddenIPs": [], // Banned IPs

  "defaultLevelId": "lvl_iLOVEaLOTlemverse", // Default level Id created at first run.
  "defaultKickLevelId": "lvl_IamINlemverseJAIL", // Default level Id when kicking people from current level

  "respawnDelay": 540, // Spawn users to the level's spawn point after 9 hours. Remove this to disable the respawn

  "email": {
    "from": "The lembot <contact@domain.com>"
  },

  "meet": {
    "enableAuth": false
  },

  "peer": {
    "path": "/peer",
    "client": {
      "url": "peer.example.com",
      "port": 443,
      "secret": "******", // Required for turn server support
      "credentialDuration": 86400,
      "config": {
        "iceServers": [
          {
            "urls": "stun:stun.l.google.com:19302"
          }
        ],
        "iceTransportPolicy": "all",
        "sdpSemantics": "unified-plan"
      }
    },
    // Details about the configuration bellow is available here: https://github.com/peers/peerjs-server#config--cli-options
    "server": {
      "port": 7010,
      "key": "peerjs",
      "alive_timeout": 60000,
      "expire_timeout": 5000,
      "allow_discovery": false
    }
  },

  // Use AWS s3 bucket to make the app stateless
  "s3": {
    "key": "AWSKEY",
    "secret": "AWSSECRET",
    "bucket": "BUCKETNAME",
    "region": "eu-west-3",
    // Fetch image from a CDN instead of the bucket
    "cdn": {
      "url": "https://cdn.cloudfront.net/"
    }
  },

  // Use Monti APM
  "monti": {
    "appId": "",
    "appSecret": "",
    "options": {
      "uploadSourceMaps": false
    }
  },

  "packages": {
    // configure external authentication services
    "service-configuration": {
      // An authentication button with the name of the service will be displayed.
      // you can automatically trigger the authentication service by passing the idpHint parameter to the url of your server.
      // example: https://app.lemverse.com/idpHint=custom will automatically trigger the "custom" login service
      "custom": {
        // for pure OAuth identity provider
        "buttonBackgroundColor": "#ea4335",
        "buttonTextColor": "white",
        "clientId": "xxxxxxx",
        "type": "oauth",
        "custom": true, // true for custom OAuth2 provider (not for social login)
        "hidden": false, // when true hides the login button, the oauth service remains configured and can be triggered by the url parameter idpHint=custom
        "secret": "xxxxxxx",
        "authUrl": "https://auth.example.org/oauth/authorize",
        "accessTokenUrl": "https://auth.example.org/oauth/access_token",
        "identityUrl": "https://auth.example.org/oauth/userinfo",
        "serverURL": "http://localhost:3000/",
        "responseType": "code",
        "loginStyle": "redirect",
        "scope": "openid",
        "identity": ["firstName", "lastName"]
      },
      // Social login with preconfigured oauth providers
      "twitter": {
        "consumerKey": "xxxxxxx",
        "secret": "xxxxxxx",
        "type": "oauth",
        "custom": false,
        "loginStyle": "redirect"
      },
      "github": {
        "clientId": "xxxxxxx",
        "buttonBackgroundColor": "#5880ff",
        "buttonTextColor": "white",
        "type": "oauth",
        "custom": false,
        "secret": "xxxxxxx"
      },
      "google": {
        "clientId": "xxxxxxx",
        "buttonBackgroundColor": "#5880ff",
        "buttonTextColor": "white",
        "type": "oauth",
        "custom": false,
        "secret": "xxxxxxx",
        "loginStyle": "redirect"
      },
      "facebook": {
        "appId": "xxxxxxx",
        "buttonBackgroundColor": "#5880ff",
        "buttonTextColor": "white",
        "type": "oauth",
        "custom": false,
        "secret": "xxxxxxx",
        "loginStyle": "redirect"
      }
    },
    "email": {
      "service": "Mailgun",
      "user": "postmaster@meteor.com",
      "password": "superDuperPassword"
    }
  }
}
```

</p>
</details>

# Getting started!

Once you have cloned the repo:

- Install system dependencies:
  - [Meteor](https://docs.meteor.com/install.html) (you will need to [install NodeJS](https://nodejs.org/en/download/) if you are using Windows)
  - GraphicsMagick (most likely available in your package manager, e.g. `brew install graphicsmagick`)
- Go to `./app/`
- Install JS dependencies: `meteor npm install`
- Run the app: `meteor --settings settings-dev.json`

The app should now be accessible at `http://localhost:3000`, and MongoDB at `mongodb://localhost:3001/meteor`.

## LocalTunnel to debug with other computers

Webrtc is working when on localhost, but if you want to test with another computer you need to have an HTTPS connection.  
You will need to use a tunnel to expose you laptop over internet.

We decided to use [localtunnel](https://github.com/localtunnel/localtunnel).  
Once it's installed on an accessible server, setup env variable `LT_DOMAIN` without http(s) so just the domain.

After that, simply launch `ROOT_URL=https://lemverse-$(whoami).${LT_DOMAIN} meteor --settings settings-dev.json`.

Modify `createMyPeer` in `peer.js` to change the host to `lemverse-peer-USER-DOMAIN` while `USER`=`whoami` and `DOMAIN`=`LT_DOMAIN` env variable.

Access to your local instance at: `https://lemverse-USER-DOMAIN`.

> :warning: Don't forget to change the port to 443 for peers when using local tunnel

## First login

Simply create your account and voila!  
You now have a nice player with everything is black!

The first user will always be an admin and so has the right to edit the level by pressing `E`.
If you are not the first user, you are not admin, and so you can not change anything 😭.  
Let's change that!

Execute this command and you should become admin:

```js
remote(
  `Meteor.users.update(Meteor.userId(), { $set: { roles: { admin: true } }})`
);
```

Now enjoy the possibility to edit by simply pressing `E` on you keyboard (see more detail below).

ℹ️ In production, to execute the `remote` command you need to add yourself (`Meteor.userId()`) in the admin array in `settings.json` (something like `usr_XXXXXX`) or hide it in the `/usr/local/etc/lemverse.json` (Server side only!).

## Roles

In lemverse you have different roles:

- `Guest`: Can move everywhere but can not talk, share screen nor listen
- `User`: Can move everywhere except admin zone (`adminOnly=true`), talk, listen, share screen
- `Editor`: Same as `User` but can also edit the level
- `Admin`: Same as `Editor` (for all levels) but can go to every zones and give people `Editor` roles (Through UI)
- `God`: Same as `Admin` but can also run `remote` command from the console

# Deploy in production!

## Docker images

### Official image

The official lemverse image is `lempire/lemverse`.  
If you want to pull the last version, you should do:  
`docker pull lempire/lemverse:latest`

### Build

#### Production

To build the latest version of lemverse, simply run the following command:  
`docker build . -t lempire/lemverse:latest`

#### Development

To build from you source without having to install anything, you can run the following command:

`docker build -f Dockerfile.dev . -t lempire/lemverse:dev`

Or run the full dev env with hot reload: `docker-compose up -d`  
It take a while to start the server.
Then every change in the project will be automatically reloaded.

### Deploy

Visit `example/docker-compose-prod` to find the deployment instructions with `docker-compose` stack.

## Slack Notification upon deployment

To have a slack notification, you need to install the [slack cli](https://github.com/rockymadden/slack-cli) on the workstation from which you will deploy.

You should also have an environment variable `LEMVERSE_CHANNEL`

# Useful commands/tricks

## Beta flag

If you want to add feature either not completely finished or just to test for few users, you should use `beta flags`.

To use the beta flag, you have one function `isLemverseBeta` which can be called either in `.hbs` file as is or in `.js` with `lp.isLemverseBeta('myBetaFlag')`.

The beta flag are stored in an array named `beta` inside each document in `users` collection.

## Maintenance aka Import/Export data

### Export

Since the data is stored in mongo database, you can simply use the command:

```bash
mongoexport --db lemverse --collection=tilesets --jsonArray --out lemverse-tilesets.json
```

### Import

To import a saved collection, use the following command to import it:

```bash
mongoimport --db=lemverse --collection=tilesets --host=localhost --port=9001 --file=./lemverse-tilesets.json --drop --jsonArray
```

The command will replace the current `tilesets` collection with the data inside the file.

## `remote` command

Within your browser, you can safely (`god` only) execute command in your backend.

We provide a command named `remote` that will pass the content to the backend to be executed with `eval`.

For example, to add a beta flag to yourself execute this command in your browser:

```js
remote(
  "Meteor.users.update({ _id: Meteor.userId() }, { $addToSet: { 'beta': { $each: ['myAwesomeFeature'] } } });"
);
```

## Custom avatars

It's possible to modify the avatars displayed during a discussion using an image API. To do so, you just have to modify the `settings.json` file.

You can add dynamic parameters to your URL using `[user_id]` or `[user_name]` to access id and name of the user who requests an avatar.

Website with images API :

- [Unsplash](https://source.unsplash.com)
- [Robohash](https://robohash.org)

> Example with Robohash: `https://robohash.org/[user_name]?set=set4&bgset=bg2&size=320x240`

# Assets

We use paid assets from [limezu](https://limezu.itch.io/) on [itch.io](https://limezu.itch.io/moderninteriors).

By default lemverse appears in black because you have no textures in the project, you must go to the editor to upload the different textures.

# Star History

[![Star History Chart](https://api.star-history.com/svg?repos=l3mpire/lemverse&type=Date)](https://star-history.com/#l3mpire/lemverse&Date)

# License

AGPLv3

# Credits

- [Meteor](https://www.meteor.com/)
- [Phaser](https://phaser.io/)
- [Material Design Icons](https://materialdesignicons.com/) for their icons
- [Everybody who contribute on it](https://github.com/l3mpire/lemverse/graphs/contributors)!

# Screenshots

<img alt="login" src="./app/public/screenshot-login.png">  
<img alt="Enter Zone" src="./app/public/screenshot-zone.png">  
<img alt="I see ghost everywhere!" src="./app/public/screenshot-ghost.png">
