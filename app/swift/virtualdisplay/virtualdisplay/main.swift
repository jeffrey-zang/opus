import Foundation

let descriptor = CGVirtualDisplayDescriptor()
descriptor.setDispatchQueue(DispatchQueue.main)
descriptor.name = "Opus Display"
descriptor.maxPixelsWide = 1920
descriptor.maxPixelsHigh = 1080
descriptor.sizeInMillimeters = CGSize(width: 1600, height: 1000)
descriptor.productID = 0x1234
descriptor.vendorID = 0x3456
descriptor.serialNum = 0x0001

let display = CGVirtualDisplay(descriptor: descriptor)
//store.dispatch(ScreenViewAction.setDisplayID(display.displayID))

let settings = CGVirtualDisplaySettings()
settings.hiDPI = 1
settings.modes = [
  // 16:9
  CGVirtualDisplayMode(width: 3840, height: 2160, refreshRate: 60),
  CGVirtualDisplayMode(width: 2560, height: 1440, refreshRate: 60),
  CGVirtualDisplayMode(width: 1920, height: 1080, refreshRate: 60),
  CGVirtualDisplayMode(width: 1600, height: 900, refreshRate: 60),
  CGVirtualDisplayMode(width: 1366, height: 768, refreshRate: 60),
  CGVirtualDisplayMode(width: 1280, height: 720, refreshRate: 60),
  // 16:10
  CGVirtualDisplayMode(width: 2560, height: 1600, refreshRate: 60),
  CGVirtualDisplayMode(width: 1920, height: 1200, refreshRate: 60),
  CGVirtualDisplayMode(width: 1680, height: 1050, refreshRate: 60),
  CGVirtualDisplayMode(width: 1440, height: 900, refreshRate: 60),
  CGVirtualDisplayMode(width: 1280, height: 800, refreshRate: 60),
]

display.apply(settings)
print("created virtual display")

let ws = NSWorkspace.shared
let apps = ws.runningApplications
var env = "prod"

for argument in CommandLine.arguments {
  if argument == "dev" {
    env = "dev"
  }
}
print(env)

var loop = true
while loop {
  sleep(60)
  loop = false
  for currentApp in apps {
    if env == "prod" && currentApp.localizedName == "Opus"
      || env == "dev" && currentApp.localizedName == "Electron"
    {
      loop = true
    }
  }
}
