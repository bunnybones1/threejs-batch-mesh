const three = require("three");

function _decorateBefore(target, methodName, newMethod) {
    const oldMethod = target[methodName];
    target[methodName] = function wrapper() {
        newMethod.apply(this, arguments);
        return oldMethod.apply(this, arguments);
    }
}
function _decorateConditional(target, methodName, conditionMethod) {
    const oldMethod = target[methodName];
    target[methodName] = function wrapper() {
        if(conditionMethod.apply(this, arguments)) {
            return oldMethod.apply(this, arguments);
        }
    }
}


function visibilityCheck() {
    return (this instanceof three.Mesh || this instanceof three.Camera || this instanceof three.Light || this.children.length > 0);
}

function SneakyOptimizations(scene) {
    _decorateConditional(three.Object3D.prototype, "updateMatrix", visibilityCheck);
    _decorateConditional(three.Object3D.prototype, "updateMatrixWorld", visibilityCheck);
}

module.exports = SneakyOptimizations;