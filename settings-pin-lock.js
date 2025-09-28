/********************************************************
Copyright (c) 2025 Cisco and/or its affiliates.
This software is licensed to you under the terms of the Cisco Sample
Code License, Version 1.1 (the "License"). You may obtain a copy of the
License at
               https://developer.cisco.com/docs/licenses
All use of the material herein must be in accordance with the terms of
the License. All rights not expressly granted by the License are
reserved. Unless required by applicable law or agreed to separately in
writing, software distributed under the License is distributed on an "AS
IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express
or implied.
*********************************************************

 * Author(s):               Robert(Bobby) McGonigle Jr
 *                          Technical Marketing Engineer
 *                          Cisco Systems
 * 
 * Released: September 27, 2025
 * Updated: September 27, 2025
 * 
 * Compatibility
 *    OnPrem : Yes
 *     Cloud : Yes
 *      Edge : Yes
 *       MTR : Yes
 * 
 * Minimum RoomOS Version
 *  11.27.1.1
 * 
 * Description: 
 *    - This Macro is designed to lock the Setting Menu, but enables a pin code to unlock it
*/

import xapi from 'xapi';

const config = {
  pin: '00000000',    // Set a Pin unlock the device settings menu
  reLockTimeout: 10   // Set a default timeout in minutes for the solution to relock the settings menu. Range: Greater than 2
}

//---------------------------------------
//---------------------------------------
//---------------------------------------

let panelLocked = true;
let settingsLocked = true;
const defaultTime = (parseInt(config.reLockTimeout) > 2 ? parseInt(config.reLockTimeout) : 2);

/**Handles Timeout for Relocking */
let relockHandler = '';

function pinPrompt(uhOh = false) {
  let title = 'Enter Super Secret Code'
  if (uhOh) {
    title = 'Oops, Try Again 😝'
  }
  xapi.Command.UserInterface.Message.TextInput.Display({
    Title: title,
    Text: 'Enter the admin pin to unlock the device settings',
    FeedbackId: 'settingsAdminPin',
    InputType: 'Password',
    Duration: 45
  })
}

async function relock(cause) {
  clearTimeout(relockHandler)
  settingsLocked = true;
  panelLocked = true;
  await xapi.Command.UserInterface.Extensions.Panel.Close();
  await xapi.Config.UserInterface.SettingsMenu.Mode.set('Locked');
  await xapi.Command.UserInterface.Message.Alert.Clear();
  await xapi.Command.UserInterface.Extensions.Widget.UnsetValue({ WidgetId: 'settings_admin_hidden~settingsLock' })
  console.log({ Message: 'Settings Locked', Cause: cause })
}

async function unlock(cause) {
  settingsLocked = false;
  await xapi.Config.UserInterface.SettingsMenu.Mode.set('Unlocked');
  relockHandler = setTimeout(async () => {
    relock('Unlock Timeout to Relock Completed');
  }, defaultTime * 60 * 1000);
  await xapi.Command.UserInterface.Message.Alert.Display({
    Title: 'Settings Menu Unlocked',
    Text: `You have ${defaultTime} to complete your actions befire the system relocks itself`
  })
  await xapi.Command.UserInterface.Extensions.Panel.Close();
  console.log({ Message: 'Settings Unlocked', Cause: cause })
}

xapi.Event.UserInterface.Extensions.Widget.Action.on(async ({ WidgetId, Type, Value }) => {
  if (Type == 'released') {
    switch (WidgetId) {
      case 'settings_admin_hidden~settingsLock':
        switch (Value) {
          case 'lock':
            await relock('Settings Admin Manually Locked Solution');
            break;
          case 'unlock':
            await unlock('Settings Admin Unlocked Solution');
            break;
        }
        break;
    }
  }
})

xapi.Event.UserInterface.Extensions.Event.PageClosed.on(({ PageId }) => {
  if (PageId == 'settings_admin_hidden~panelUI') {
    if (settingsLocked) {
      relock('Settings Admin Page Closed with Unlock Deselected');
    }
  }
});

xapi.Event.UserInterface.Extensions.Panel.Clicked.on(({ PanelId }) => {
  if (PanelId == 'settings_admin_visible' && settingsLocked) {
    pinPrompt()
  } else {
    xapi.Command.UserInterface.Extensions.Panel.Open({ PanelId: 'settings_admin_hidden' });
  }

  if (PanelId == 'settings_admin_hidden' && panelLocked) {
    xapi.Command.UserInterface.Extensions.Panel.Close();
  }
})

xapi.Event.UserInterface.Extensions.Panel.Open.on(({ PanelId }) => {
  if (PanelId == 'settings_admin_hidden' && panelLocked) {
    xapi.Command.UserInterface.Extensions.Panel.Close();
  }
})

xapi.Event.UserInterface.Message.TextInput.Response.on(async ({ FeedbackId, Text }) => {
  if (FeedbackId == 'settingsAdminPin') {
    if (Text == config.pin) {
      panelLocked = false;
      xapi.Command.UserInterface.Extensions.Panel.Open({ PanelId: 'settings_admin_hidden' });
    } else {
      await relock('User Failed Pin Code Entry');
      pinPrompt(true);
    }
  }
})

async function buildUI(){
  const visibleXML = `<Extensions> <Panel> <Order>999</Order> <Origin>local</Origin> <Location>ControlPanel</Location> <Icon>Helpdesk</Icon> <Name>Settings Admin</Name> <ActivityType>Custom</ActivityType> </Panel> </Extensions>`;
  const hiddenXML = `<Extensions> <Panel> <Order>999</Order> <Origin>local</Origin> <Location>Hidden</Location> <Icon>Lightbulb</Icon> <Name>Settings Admin</Name> <ActivityType>Custom</ActivityType> <Page> <Name>Settings Admin</Name> <Row> <Name>Row</Name> <Widget> <WidgetId>settings_admin_hidden~note1</WidgetId> <Name>Pressing Unlock will unlock the Device's Settings.</Name> <Type>Text</Type> <Options>size=4;fontSize=normal;align=center</Options> </Widget> </Row> <Row> <Name>Row</Name> <Widget> <WidgetId>settings_admin_hidden~note2</WidgetId> <Name>Please Lock this back down after you're done making your changes</Name> <Type>Text</Type> <Options>size=4;fontSize=normal;align=center</Options> </Widget> </Row> <Row> <Name>Row</Name> <Widget> <WidgetId>settings_admin_hidden~settingsLock</WidgetId> <Type>GroupButton</Type> <Options>size=4</Options> <ValueSpace> <Value> <Key>lock</Key> <Name>Lock</Name> </Value> <Value> <Key>unlock</Key> <Name>Unlock</Name> </Value> </ValueSpace> </Widget> </Row> <PageId>settings_admin_hidden~panelUI</PageId> <Options>hideRowNames=1</Options> </Page> </Panel> </Extensions> `;

  await xapi.Command.UserInterface.Extensions.Panel.Save({PanelId: 'settings_admin_visible'}, visibleXML);
  await xapi.Command.UserInterface.Extensions.Panel.Save({PanelId: 'settings_admin_hidden'}, hiddenXML);
}

async function init() {
  await buildUI();
  await relock('Script Initialization');
  console.log(`Solution Lock timeout set to ${defaultTime}`)
}

init();