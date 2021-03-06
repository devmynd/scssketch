const common = require("./common")
const _ = require("lodash")
const sketch = context.api()
const document = sketch.selectedDocument
const pages = document.sketchObject.pages()
const symbolsPage = _.find(pages, (page) => {
  return String(page.name()).toLowerCase() === "symbols"
})

module.exports = {
  parse: (sharedStyles, sharedTextStyles, layerStyles) => {
    var result = [];
    if (!symbolsPage) {
      console.log("There is no symbols page.")
      return false
    }

    // get button symbols
    var buttonSymbols = _.filter(symbolsPage.layers(), (layer) =>{
      return (String(layer.name()).toLowerCase().startsWith("button"))
    })
    result = result.concat(getElementAttributes("button", buttonSymbols, sharedStyles, sharedTextStyles, layerStyles))
    
    // get text inputs
    var textInputs = _.filter(symbolsPage.layers(), (layer) =>{
      return (String(layer.name()).toLowerCase().startsWith("text input"))
    })
    result = result.concat(getElementAttributes("textInput", textInputs, sharedStyles, sharedTextStyles, layerStyles))
    


    return result
  },
  
  writeSass: (styles) => {
    var css = ""
    _.forEach(styles, (style) => {
      css += "// " + style.name + "\n"
      css += "@mixin " + _.kebabCase(style.name) + " {\n"

      if ((style.elementType == "textInput" ||
        style.elementType == "textArea") &&
        (style.name.toLowerCase().endsWith("placeholder") ||
          style.name.toLowerCase().endsWith("empty"))) {

        css += "  opacity: 1;\n"
      } else {
        css += "  box-sizing: border-box;\n"
        if (style.elementType != "textArea") {
          css += "  height: " + style.attributes.height + "px;\n"
        }
        if (style.attributes.width) {
          css += "  width: " + style.attributes.width + "px;\n"
        }
        css += "  background: " + style.attributes.background + ";\n"
        css += "  border-style: solid;\n"
        css += "  border-color: " + style.attributes.borderColor + ";\n"
        css += addBorderPropertyToCss(style.attributes.borderThickness, "border-width")
        css += addBorderPropertyToCss(style.attributes.borderRadius, "border-radius")
        css += addPaddingValuetoCss(style)
        if (style.attributes.shadow) {
          css += "  box-shadow: " + style.attributes.shadow + ";\n"
        }
      }
      css += "  @include  " + style.attributes.textStyle + ";\n"
      css += "  color: " + style.attributes.textColor + ";\n"
      css += "  text-align: " + style.attributes.textAlignment + ";\n"


      css += "}\n\n"
    })
    return css
  }
}

function addBorderPropertyToCss(collection, property) {
  var prop = ""
  _.forEach(collection, (val) => {
    prop += val + "px "
  })
  if (collection.every( (val, i) => val === collection[0])) {
    prop = collection[0] + "px";
  }
  return `  ${property}: ` + prop.trim() + ";\n"
}

function addPaddingValuetoCss(style) {
  const padding = style.attributes.padding
  var paddingValue = ""
  _.forEach(padding, (val, i) => {
    paddingValue += (val - style.attributes.borderThickness[i]) + "px "
  })
  if (padding && padding.every( (val, i) => val === padding[0])) {
    paddingValue = padding[0] + "px";
  }
  return "  padding: " + paddingValue.trim() + ";\n"
}

function getElementAttributes (elementType, elements, sharedStyles, sharedTextStyles, layerStyles) {
  var elements = _.sortBy(elements, [element => element.name()], ["desc"])
  var results = []
  _.forEach(elements, (element) => {
    var elementAttributes = {
      "height": parseInt(element.frame().height()),
      "borderRadius": null,
      "borderThickness": null,
      "borderColor": "transparent",
      "background": null,
      "shadow": null
    }
    var searchReferenceElement = element
    // check for group
    if (String(element.layers()[0].class()).toLowerCase().indexOf("group") >= 0) {
      var shadow;
      var group = element.layers()[0]
      if (group.sharedStyleID()) {
        // we have a shadow layer style, pls retrieve
        var shadow = _.find(sharedStyles.objects(), (style) => {
          return String(style.objectID()) === String(group.sharedStyleID())
        })
        if (shadow && shadow.name()) {
        shadow = String(shadow.name())
          var tag = common.getTag(shadow)
          if (tag.isTag) {
            shadow = tag.name.trim()
          }
          shadow = "$" + _.kebabCase(shadow)
        }
      }
      elementAttributes.shadow = shadow
      searchReferenceElement = element.layers()[0]    
    }

    var shape = _.find(searchReferenceElement.layers(), (layer) => {
      return String(layer.name()).toLowerCase() === "shape"
    })

    if (shape) {
      var shapeAttributes = parseShape(shape, sharedStyles, layerStyles)
      elementAttributes = setShapeElementAttributes(shapeAttributes, elementAttributes)
    }

    // Check for text layer
    var textLayer = _.find(searchReferenceElement.layers(), (layer) => {
      var layerName = String(layer.name()).toLowerCase()
      return (layerName.indexOf("label") >= 0 || layerName.indexOf("value") >= 0)
    })
    if (!textLayer) {
      elementAttributes.width = parseInt(element.frame().width())
    } else {
      elementAttributes = setTextLayerElementAttributes(textLayer, layerStyles, searchReferenceElement, sharedTextStyles, elementAttributes)
    }
    results.push({"name": String(element.name()), "elementType": elementType, "attributes": elementAttributes})
  })
  
  return results
}

function setTextLayerElementAttributes(textLayer, layerStyles, element, sharedTextStyles, elementAttributes) {
  var elementAttr = elementAttributes
  var symbolAlpha = 1;
  var textAlpha = 1;
  var shadow = "!do-nothing";


  // check for symbol
  if (String(textLayer.class()).toLowerCase().indexOf("symbol") >= 0) {
    symbolAlpha = parseFloat(textLayer.style().contextSettings().opacity());
    textLayer = findSymbolById(textLayer.symbolID()).layers()[0]
  }
  // check for text style
  var textStyle = _.find(sharedTextStyles.objects(), (textStyle) => {
    return String(textStyle.objectID()) === String(textLayer.sharedStyleID())
  })
    
  if (textStyle) {
    textAlpha = parseFloat(textLayer.style().contextSettings().opacity());
    var tag = common.getTag(textStyle.name())
    elementAttr.textStyle = tag.cssSelector + "-text-style"
  }

  // get color
  var fontColor = "#" + String(textLayer.textColor().immutableModelObject().hexValue())
  fontColor = findLayerStyleByColor(fontColor, layerStyles.colors)
  if (textAlpha * symbolAlpha < 1) {
    fontColor = "rgba(" + fontColor + ", " + (Math.round(textAlpha * symbolAlpha * 100) / 100) + ")"
  }
  elementAttr.textColor = fontColor

  // get alignment
  var fontAlignment = textLayer.style().textStyle().attributes().NSParagraphStyle
  if (fontAlignment) {
    fontAlignment = fontAlignment.alignment()
    if (fontAlignment === 0) {
      fontAlignment = "left"
    } else if (fontAlignment === 1) {
      fontAlignment = "right"
    } else if (fontAlignment === 2) {
      fontAlignment = "center"
    } else if (fontAlignment === 3) {
      fontAlignment = "justified"
    }
  } else {
    fontAlignment = "left"
  }
  elementAttr.textAlignment = fontAlignment

  // get padding!!!
  var getText = _.find(element.layers(), (layer) => {
    return (String(layer.name()).toLowerCase() === "label" ||
      String(layer.name()).toLowerCase() === "value")
  })
  
  if (getText) {
    var padding = [0,0,0,0],
      leftPadding = parseInt(element.frame().width()) - parseInt(getText.frame().width()) - getText.frame().x()
      rightPadding = parseInt(getText.frame().x()),
      topPadding = parseInt(getText.frame().y()),
      symbolTopOffset = 0,
      symbolBottomOffset = 0
    // check for symbol
    var firstTier = getText

    if (String(getText.class()).toLowerCase().indexOf("symbol") >= 0) {
      // get the offsets
      var symbolHeight = parseInt(getText.frame().height())
      getText = findSymbolById(getText.symbolID()).layers()[0]
      symbolTopOffset = getText.frame().y()
    }
    elementAttr.padding = [
      topPadding + symbolTopOffset,
      leftPadding,
      parseInt(element.frame().height()) - (parseInt(getText.frame().height()) + topPadding + symbolTopOffset),
      rightPadding
    ]
  }
  
  return elementAttr
}

function setShapeElementAttributes(shapeAttributes, elementAttributes) {
  var elementAttr = elementAttributes
  if (shapeAttributes.background) {
    elementAttr.background = shapeAttributes.background
  }
  if (shapeAttributes.borderColor) {
    elementAttr.borderColor = shapeAttributes.borderColor
  }
  if (shapeAttributes.borderRadius) {
    elementAttr.borderRadius = shapeAttributes.borderRadius
  }
  if (shapeAttributes.borderThickness) {
    elementAttr.borderThickness = shapeAttributes.borderThickness
  }
  
  return elementAttr
}

function findLayerStyleByColor(color, styles) {
  var result = _.find(styles, (style) => {
    return String(style.value) === String(color)
  })
  
  if (result) {
    return "$" + result.name
  } 
  
  return color
}

function findSymbolById (theid) {
  return _.find(symbolsPage.layers(), (layer) => {
    return (layer.symbolID && String(layer.symbolID()) === String(theid))
  })
}

function getShapeOverrides (shapeSymbol, sharedStyles) {
  // establish overrides
  var overrides = []
  if (shapeSymbol.overrideValues && shapeSymbol.overrideValues().length > 0) {
    _.forEach(shapeSymbol.overrideValues(), (override) => {
      var overrideName = override.overrideName()
      var overrideObjectID = String(override.objectID())
      var overrideType = String(overrideName).split("_")[1]
      var symbolID = String(override.symbolID)
      overrideName = String(overrideName).replace("_" + overrideType, "").split("/")
      overrides.push({
        "symbolID": symbolID, 
        "overrideName": overrideName, 
        "overrideType": overrideType, 
        "overrideValue": String(override.value()), 
        "objectID": overrideObjectID})
    })
  }

  var overrideResults = {
    "background": "do nothing",
    "borderThickness": "do nothing",
    "borderColor": "do nothing"
  }

  var symbolMaster = findSymbolById(shapeSymbol.symbolID())

  var symbolOverrides = _.filter(overrides, (override) => {
    return override.overrideType.startsWith("symbol") && override.overrideValue.length
  })

  var layerStyleOverrides = _.filter(overrides, (override) => {
    return override.overrideType.startsWith("layerStyle") &&
      override.overrideValue.length
  })

  _.forEach(symbolOverrides, (override) => {
    var valueSymbol = findSymbolById(override.overrideValue)
    if(valueSymbol) {
      overrideResults.borderThickness = getBorderThickness(valueSymbol)
    }
  })

  _.forEach(layerStyleOverrides, (override) => {
    var style = _.find(sharedStyles.objects(), (style) => {
      return String(style.objectID()) === override.overrideValue
    })

    var layerToOverride = _.find(symbolMaster.layers(), (layer) => {
      return String(layer.objectID()) === String(override.overrideName[0])
    })

    if (layerToOverride && style) {
      var colorValue = common.getTag(String(style.name()))
      if (String(colorValue.name).toLowerCase() === "none" ||
        String(colorValue.name).toLowerCase() === "[x] none") {
        colorValue = "transparent"
      } else {
        colorValue = "$" + _.kebabCase(colorValue.name) + "-color"
      }  

      var attrib = String(layerToOverride.name()).toLowerCase()

      if (attrib.startsWith("fill")) {
        overrideResults.background = colorValue
      } else if (attrib.startsWith("border")) {
        overrideResults.borderColor = colorValue
      }
    }
  })

  return overrideResults
}

function getBorderThickness (border) {
  var borderThickness = {"top": 0,"bottom":0,"left":0,"right":0}
  var shape = border.layers()[0]
  var outer = {"top": 0,"bottom":0,"left":0,"right":0}
  var inner = {"top": 0,"bottom":0,"left":0,"right":0}
  shape.layers().forEach(function(shape, index){
    if (index == 0) {
      outer.top = parseFloat(shape.frame().y())
      outer.left = parseFloat(shape.frame().x())
      outer.bottom = parseFloat(shape.frame().height()) + outer.top
      outer.right = parseFloat(shape.frame().width()) + outer.left
    } else {
      inner.top = parseFloat(shape.frame().y())
      inner.left = parseFloat(shape.frame().x())
      inner.bottom = parseFloat(shape.frame().height()) + inner.top
      inner.right = parseFloat(shape.frame().width()) + inner.left
    }
  })
  return [Math.abs(outer.top - inner.top),
    Math.abs(outer.bottom - inner.bottom),
    Math.abs(outer.left - inner.left),
    Math.abs(outer.right - inner.right)]


}

function parseShape (layer, sharedStyles, layerStyles) {
  var radius,
      background,
      borderThickness,
      borderColor = "transparent",
      shapeSymbolMaster = findSymbolById(layer.symbolID())

  // We need to get the fill symbol
  var fillLayer = _.find(shapeSymbolMaster.layers(), (layer) => {
    return (String(layer.name()).toLowerCase().split(" ")[0] === "fill")
  })

  if (fillLayer) {
    radius = []
    _.forEach(fillLayer.points(), (point) => {
      radius.push(parseFloat(point.cornerRadius()))
    })
    background = "#" + fillLayer.style().firstEnabledFill().color().immutableModelObject().hexValue()
  }

  var border = _.find(shapeSymbolMaster.layers(), (layer) => {
    return (String(layer.name()).toLowerCase().startsWith("border"))
  })
  border = findSymbolById(border.symbolID())
  borderThickness = getBorderThickness(border)

  var overrideValues = getShapeOverrides(layer, sharedStyles)

  if (overrideValues.background != "do nothing") {
    background = overrideValues.background
  }

  if (overrideValues.borderColor != "do nothing") {
    borderColor = overrideValues.borderColor
  }

  if (overrideValues.borderThickness != "do nothing") {
    borderThickness = overrideValues.borderThickness
  }

  return {
    "borderRadius": radius, 
    "background": findLayerStyleByColor(background, layerStyles.colors),
    "borderThickness": borderThickness, 
    "borderColor": findLayerStyleByColor(borderColor)
  }
}
