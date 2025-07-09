#!/usr/bin/swift

import AppKit
import CoreGraphics
import Foundation

let options: CGWindowListOption = [.optionOnScreenOnly, .excludeDesktopElements]
let windowListInfo =
  CGWindowListCopyWindowInfo(options, kCGNullWindowID) as NSArray? as? [[String: AnyObject]]

var result: [[String: Any]] = []

var appPid: pid_t?
if let bundleId = CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : nil,
  let app = NSRunningApplication.runningApplications(withBundleIdentifier: bundleId).first
{
  appPid = app.processIdentifier
}

windowListInfo?.forEach { window in
  guard let pid = window[kCGWindowOwnerPID as String] as? Int,
    let owner = window[kCGWindowOwnerName as String] as? String
  else { return }

  let title = window[kCGWindowName as String] as? String ?? ""

  if appPid != nil {
    if appPid! == pid {
      result.append([
        "pid": pid,
        "app": owner,
        "name": title,
      ])
    }
  } else {

    result.append([
      "pid": pid,
      "app": owner,
      "name": title,
    ])
  }
}

if let jsonData = try? JSONSerialization.data(withJSONObject: result, options: .prettyPrinted),
  let jsonString = String(data: jsonData, encoding: .utf8)
{
  print(jsonString)
}
