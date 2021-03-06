const defaultBaseFontSize = 16;
var mobileBaseFontSize = defaultBaseFontSize;
var desktopBaseFontSize = defaultBaseFontSize;
module.exports = {
  
  getTag: (name) => {  
    var regex = /^\[(([A-Za-z])(\d\.*[0-9]*|[\p|\P]+))(.*)\]\s(.*)/g,
        tag = name,
        isTag = false,
        match = regex.exec(name),
        ramp = "",
        selector,
        variant,
        cssSelector,
        tagName = name

    if (match) {
      isTag = true
      tag = match[1].toLowerCase()
      ramp = match[2].toLowerCase()
      selector = match[3].toLowerCase()
      cssSelector = match[3].toLowerCase()
      if (cssSelector != "p") {
        cssSelector = "h" + selector
      }
      variant = match[4]
      tagName = match[5]
    }
    
    return {
      "isTag": isTag, 
      "tag": tag, 
      "ramp": ramp,
      "selector": selector, 
      "cssSelector": cssSelector, 
      "variant": variant, 
      "name": tagName
    }
  },
  
  rgbaToCSS: (color, opacityMultiplier) => {
    if (!opacityMultiplier) {
      opacityMultiplier = 1
    }
    var rgba = color.toString().replace(/[a-z]|:/g, "")
    var temprgba = rgba.slice(rgba.indexOf("(") + 1, rgba.indexOf(")") - 1).split(" ")
    rgba = "rgba("
    temprgba.forEach(function(value, index){
      if (index < 3) {
        rgba = rgba + Math.round(255 * value) + ", "
      } else {
        rgba = rgba + removeZeros(value * opacityMultiplier) + ", "
      }
    })
    return rgba.slice(0, -2) + ")"
  },
  getDefaultBaseFontSize: () => {
    return defaultBaseFontSize
  },
  getMobileBaseFontSize: () => {
    return mobileBaseFontSize
  },
  getDesktopBaseFontSize: () => {
    return desktopBaseFontSize
  },
  setMobileBaseFontSize: (size) => {
    mobileBaseFontSize = size
  },
  setDesktopBaseFontSize: (size) => {
    desktopBaseFontSize = size
  },
  pixelsToRem: (pixelValue, baseSize) => {
    return Math.round((pixelValue / baseSize) * 1000) / 1000
  },

}

function removeZeros(str){
  str = String(str)
  var regEx1 = /[0]+$/
  var regEx2 = /[.]$/
  if (str.indexOf('.')>-1){
      str = str.replace(regEx1,'')  // Remove trailing 0's
  }
  return str.replace(regEx2,'')  // Remove trailing decimal
}
