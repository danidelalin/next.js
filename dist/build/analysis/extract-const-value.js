"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.extractExportedConstValue = extractExportedConstValue;
exports.tryToExtractExportedConstValue = tryToExtractExportedConstValue;
function extractExportedConstValue(module, exportedName) {
    for (const moduleItem of module.body){
        if (!isExportDeclaration(moduleItem)) {
            continue;
        }
        const declaration = moduleItem.declaration;
        if (!isVariableDeclaration(declaration)) {
            continue;
        }
        if (declaration.kind !== "const") {
            continue;
        }
        for (const decl of declaration.declarations){
            if (isIdentifier(decl.id) && decl.id.value === exportedName && decl.init) {
                return extractValue(decl.init);
            }
        }
    }
    throw new NoSuchDeclarationError();
}
function tryToExtractExportedConstValue(module, exportedName) {
    try {
        return extractExportedConstValue(module, exportedName);
    } catch (error) {
        if (error instanceof UnsupportedValueError || error instanceof NoSuchDeclarationError) {
            return undefined;
        }
    }
}
function isExportDeclaration(node) {
    return node.type === "ExportDeclaration";
}
function isVariableDeclaration(node) {
    return node.type === "VariableDeclaration";
}
function isIdentifier(node) {
    return node.type === "Identifier";
}
function isBooleanLiteral(node) {
    return node.type === "BooleanLiteral";
}
function isNullLiteral(node) {
    return node.type === "NullLiteral";
}
function isStringLiteral(node) {
    return node.type === "StringLiteral";
}
function isNumericLiteral(node) {
    return node.type === "NumericLiteral";
}
function isArrayExpression(node) {
    return node.type === "ArrayExpression";
}
function isObjectExpression(node) {
    return node.type === "ObjectExpression";
}
function isKeyValueProperty(node) {
    return node.type === "KeyValueProperty";
}
function isRegExpLiteral(node) {
    return node.type === "RegExpLiteral";
}
class UnsupportedValueError extends Error {
}
class NoSuchDeclarationError extends Error {
}
function extractValue(node) {
    if (isNullLiteral(node)) {
        return null;
    } else if (isBooleanLiteral(node)) {
        // e.g. true / false
        return node.value;
    } else if (isStringLiteral(node)) {
        // e.g. "abc"
        return node.value;
    } else if (isNumericLiteral(node)) {
        // e.g. 123
        return node.value;
    } else if (isRegExpLiteral(node)) {
        // e.g. /abc/i
        return new RegExp(node.pattern, node.flags);
    } else if (isIdentifier(node)) {
        switch(node.value){
            case "undefined":
                return undefined;
            default:
                throw new UnsupportedValueError();
        }
    } else if (isArrayExpression(node)) {
        // e.g. [1, 2, 3]
        const arr = [];
        for (const elem of node.elements){
            if (elem) {
                if (elem.spread) {
                    // e.g. [ ...a ]
                    throw new UnsupportedValueError();
                }
                arr.push(extractValue(elem.expression));
            } else {
                // e.g. [1, , 2]
                //         ^^
                arr.push(undefined);
            }
        }
        return arr;
    } else if (isObjectExpression(node)) {
        // e.g. { a: 1, b: 2 }
        const obj = {};
        for (const prop of node.properties){
            if (!isKeyValueProperty(prop)) {
                // e.g. { ...a }
                throw new UnsupportedValueError();
            }
            let key;
            if (isIdentifier(prop.key)) {
                // e.g. { a: 1, b: 2 }
                key = prop.key.value;
            } else if (isStringLiteral(prop.key)) {
                // e.g. { "a": 1, "b": 2 }
                key = prop.key.value;
            } else {
                throw new UnsupportedValueError();
            }
            obj[key] = extractValue(prop.value);
        }
        return obj;
    } else {
        throw new UnsupportedValueError();
    }
}

//# sourceMappingURL=extract-const-value.js.map