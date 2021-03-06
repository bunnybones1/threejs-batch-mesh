var three = require('three');
var extend = require('extend-shallow');
var BatchChildMesh = require('./BatchChildMesh');

/*
    consider using a "shadow" (think shadow-dom) scene instead of making the source meshes invisible

*/

function BatchMesh(scene, material) {
    this.scene = scene;
    var batchGeometry = new three.BufferGeometry();
    this.material = material;
    this.batchChildren = [];
    this.supportedAttributes = [];
    this.supportedAttributeSizes = {};
    this.attributeCursors = {
        position: 0,
        normal: 0,
        uv: 0,
        uv2: 0
    }
    
    this.dirtyIndices = false;

    three.Mesh.call(this, batchGeometry, material);
}

var tempVec3 = new three.Vector3;
function copyAndTransformPositionBuffer(dstArr, srcArr, offset, matrixWorld) {
    var total = srcArr.length;
    for(var i = 0; i < total; i += 3) {
        tempVec3.x = srcArr[i];
        tempVec3.y = srcArr[i+1];
        tempVec3.z = srcArr[i+2];
        // if(isNaN(tempVec3.x)) debugger;
        tempVec3.applyMatrix4(matrixWorld);
        // if(isNaN(tempVec3.x)) debugger;
        dstArr[offset+i] = tempVec3.x;
        dstArr[offset+i+1] = tempVec3.y;
        dstArr[offset+i+2] = tempVec3.z;
    }
    // debugger;
}
function copyAndTransformNormalBuffer(dstArr, srcArr, offset, matrixWorld) {
    var normalMatrix = new three.Matrix3().getNormalMatrix( matrixWorld );
    var total = srcArr.length;
    for(var i = 0; i < total; i += 3) {
        tempVec3.x = srcArr[i];
        tempVec3.y = srcArr[i+1];
        tempVec3.z = srcArr[i+2];
        // if(isNaN(tempVec3.x)) debugger;
        tempVec3.applyMatrix3(normalMatrix);
        // if(isNaN(tempVec3.x)) debugger;
        dstArr[offset+i] = tempVec3.x;
        dstArr[offset+i+1] = tempVec3.y;
        dstArr[offset+i+2] = tempVec3.z;
    }
}

function copyAttrBufferArray(name, dstArr, srcArr, offset, matrixWorld) {
    switch(name) {
        case "position": 
            return copyAndTransformPositionBuffer(dstArr, srcArr, offset, matrixWorld);
        case "normal": 
            return copyAndTransformNormalBuffer(dstArr, srcArr, offset, matrixWorld);
        default: 
            dstArr.set(srcArr, offset);
    }
}

function onEnterFrame() {
    var attrNames = this.supportedAttributes;
    var attrSizes = this.supportedAttributeSizes;
    var batchGeometry = this.geometry;
    if(this.dirtyIndices) {
        //recalculate buffer sizes
        for(var i = 0; i < attrNames.length; i++) {
            var attrName = attrNames[i];
            attrSizes[attrName] = this.batchChildren.reduce((total, child) => {
                return total + child.mesh.geometry.attributes[attrName].count;
            }, 0);
        }

        //allocate new sizes if necessary
        for(var i = 0; i < attrNames.length; i++) {
            var attrName = attrNames[i];
            var attribute = batchGeometry.attributes[attrName];
            if(attribute.count != attrSizes[attrName]) {
                attribute.array = new attribute.array.constructor(attrSizes[attrName] * attribute.itemSize);
                attribute.count = attrSizes[attrName];
            }
        }
    }
    
    for(var iChild = 0; iChild < this.batchChildren.length; iChild++) {
        this.batchChildren[iChild].markChangesDirty();
    }
    for(var iAttr = 0; iAttr < attrNames.length; iAttr++) {
        var attrName = attrNames[iAttr];
        var firstDirtySubmeshIndex = -1;
        var lastDirtySubmeshIndex = -1;
        var cursor = this.attributeCursors[attrName];
        var hardLimit = this.batchChildren.length;
        var softLimit = 10;
        while(hardLimit > 0 && softLimit > 0) {
            var attrDirty = this.batchChildren[cursor%this.batchChildren.length].dirtyAttributes[attrName];
            if(attrDirty){
                if(firstDirtySubmeshIndex === -1) {
                    firstDirtySubmeshIndex = cursor % this.batchChildren.length;
                }
                lastDirtySubmeshIndex = cursor % this.batchChildren.length;
            }
            hardLimit--;
            if(firstDirtySubmeshIndex !== -1) {
                softLimit--;
            }
            cursor++;
        }
        if(firstDirtySubmeshIndex !== -1 && lastDirtySubmeshIndex !== -1) {
            if(firstDirtySubmeshIndex > lastDirtySubmeshIndex) {
                lastDirtySubmeshIndex = this.batchChildren.length-1;
                cursor = 0;
            }
            var batchAttr = batchGeometry.attributes[attrName];
            
            var offset = this.batchChildren[firstDirtySubmeshIndex].itemOffset * batchAttr.itemSize;
            var subOffset = offset;
            var count = 0;

            for(var iChild = firstDirtySubmeshIndex; iChild <= lastDirtySubmeshIndex; iChild++) {
                var child = this.batchChildren[iChild];
                child.mesh.updateMatrixWorld();
                var subCount = child.itemRange * batchAttr.itemSize;
                count += subCount;
                var srcAttr = child.mesh.geometry.attributes[attrName];
                copyAttrBufferArray(attrName, batchAttr.array, srcAttr.array, subOffset, child.mesh.matrixWorld);
                subOffset += subCount;
                child.dirtyAttributes[attrName] = false;
            }

            batchAttr.needsUpdate = true;
            batchAttr.updateRange.offset = offset;
            batchAttr.updateRange.count = count;
        }
        this.attributeCursors[attrName] = cursor % this.batchChildren.length;
    }

    //TODO CLEAN UP

    if(this.dirtyIndices) {
        var totalIndices = this.batchChildren.reduce( (total, child) => {
            return total + child.mesh.geometry.index.count;
        }, 0);
        var indexAttr = batchGeometry.index;
        if( indexAttr.count != totalIndices) {
            if(totalIndices < 256*256) {
                indexAttr.array = new indexAttr.array.constructor(totalIndices);
            } else {
                indexAttr.array = new Uint32Array(totalIndices);
            }
            indexAttr.count = totalIndices;
        }

        cursor = 0;
        cursorPositions = 0;
        for(var iChild = 0; iChild < this.batchChildren.length; iChild++) {
            var child = this.batchChildren[iChild];
            var dstArr = indexAttr.array;
            var srcArr = child.mesh.geometry.index.array;
            for(var i = 0; i < srcArr.length; i++) {
                dstArr[cursor+i] = srcArr[i] + cursorPositions;
            }
            cursor += srcArr.length;
            cursorPositions += child.itemRange;
        }
        indexAttr.needsUpdate = true;
        this.dirtyIndices = false;
    }
}

function cloneEmptyAttribute(src, size = 1) {
    return new src.constructor(new src.array.constructor(size * src.itemSize), src.itemSize);
}

function generateOffset(child) {
    var index = 0;
    for(var i = 0; i < this.batchChildren.length; i++) {
        if(this.batchChildren[i] === child) {
            return index;
        } else {
            index += this.batchChildren[i].itemRange;
        }
    }
    return index;
}

function addToBatch(mesh) {
    var batchGeometry = this.geometry;
    if(this.batchChildren.length == 0) {
        this.supportedAttributes = Object.keys(mesh.geometry.attributes);
        for(var iAttr = 0; iAttr < this.supportedAttributes.length; iAttr++) {
            var attrName = this.supportedAttributes[iAttr];
            batchGeometry.addAttribute(attrName, cloneEmptyAttribute(mesh.geometry.attributes[attrName]));
            batchGeometry.attributes[attrName].dynamic = true;
            batchGeometry.attributes[attrName].name = attrName;
        }
        batchGeometry.setIndex(cloneEmptyAttribute(mesh.geometry.index));
    }
    if(mesh.material !== this.material) {
        debugger;
        throw new Error("Cannot batch Meshes that use different materials.");
    }
    if(mesh instanceof BatchMesh) {
        debugger;
        throw new Error("Cannot batch BatchMeshes.");
    }

    var newSupportedAttributes = Object.keys(mesh.geometry.attributes);
    var currentSupportedAttributes = this.supportedAttributes;
    currentSupportedAttributes.forEach(attrName => {
        if(newSupportedAttributes.indexOf(attrName) === -1) {
            console.warn("attr not supported: " + attrName + ". Reluctantly batching without this attribute.");
            delete mesh.geometry.attributes[attrName];
        }
    });
    newSupportedAttributes.forEach(attrName => {
        if(currentSupportedAttributes.indexOf(attrName) === -1) {
            debugger;
            throw new Error("attr not supported: " + attrName + ". Cannot batch.");
        }
    });

    if(Object.keys(mesh.geometry.attributes).length !== currentSupportedAttributes.length) {
        debugger;
        throw new Error("attr is missing on added mesh: " + attrName + ". Cannot batch.");
    }
    var child = new BatchChildMesh(mesh, this);
    for(var iAttr = 0; iAttr < currentSupportedAttributes.length; iAttr++) {
        var attrName = currentSupportedAttributes[iAttr];
        child.dirtyAttributes[attrName] = true;
    }
    this.batchChildren.push(child);
    mesh.visible = false;
    this.dirtyIndices = true;
    function v(size) { return new three.Vector3(size, size, size); }
    this.geometry.boundingBox = new three.Box3(v(-100), v(100));
    this.geometry.boundingSphere = new three.Sphere(v(0), 140);
}

BatchMesh.prototype = Object.create(three.Mesh.prototype);

extend(BatchMesh.prototype, {
    onEnterFrame,
    addToBatch,
    generateOffset
});

module.exports = BatchMesh;