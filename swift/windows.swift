#!/usr/bin/swift

import Foundation
import CoreGraphics

let options: CGWindowListOption = [.optionOnScreenOnly, .excludeDesktopElements]
let windowListInfo = CGWindowListCopyWindowInfo(options, kCGNullWindowID) as NSArray? as? [[String: AnyObject]]

var result: [[String: Any]] = []

windowListInfo?.forEach { window in
    guard let pid = window[kCGWindowOwnerPID as String] as? Int,
          let owner = window[kCGWindowOwnerName as String] as? String else { return }

    let title = window[kCGWindowName as String] as? String ?? ""
    result.append([
        "pid": pid,
        "app": owner,
        "name": title
    ])
}

if let jsonData = try? JSONSerialization.data(withJSONObject: result, options: .prettyPrinted),
   let jsonString = String(data: jsonData, encoding: .utf8) {
    print(jsonString)
}
