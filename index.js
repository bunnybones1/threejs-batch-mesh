var three = require('three');
var extend = require('extend-shallow');

/*
    consider using a shadow scene instead of making the source meshes invisible

*/

function BatchingMesh(scene, material) {
    this.scene = scene;
    var geometry = new three.BufferGeometry();
    this.material = material;
    this.meshes = [];
    three.Mesh.call(this, geometry, material);
    this.supportedAttributes = [];
    this.supportedAttributeSizes = {};

    this.dirtyPositions = false;
    this.dirtyIndices = false;
}

var tempVec3 = new three.Vector3;
function copyAndTransformPositionBuffer(dstArr, srcArr, offset, matrixWorld) {
    for(var i = 0; i < offset; i += 3) {
        tempVec3.x = srcArr[i];
        tempVec3.y = srcArr[i+1];
        tempVec3.z = srcArr[i+2];
        tempVec3.applyMatrix4(matrixWorld);
        dstArr[offset+i] = tempVec3.x;
        dstArr[offset+i+1] = tempVec3.y;
        dstArr[offset+i+2] = tempVec3.z;
    }
    // debugger;
}
function copyAndTransformNormalBuffer(dstArr, srcArr, offset, matrixWorld) {
    var normalMatrix = new three.Matrix3().getNormalMatrix( matrixWorld );
    for(var i = 0; i < offset; i += 3) {
        tempVec3.x = srcArr[i];
        tempVec3.y = srcArr[i+1];
        tempVec3.z = srcArr[i+2];
        tempVec3.applyMatrix3(normalMatrix);
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
    var that = this;
    if(!this.dirtyPositions) {
        this.dirtyPositions = this.meshes.some(m => {
            return !(m.positionLast.equals(m.position) && m.quaternionLast.equals(m.quaternion) && m.scaleLast.equals(m.scale));
        });
    }
    if(!this.dirtyNormals) {
        this.dirtyNormals = this.meshes.some(m => {
            return !m.quaternionLast.equals(m.quaternion);
        });
        this.dirtyNormals = true;
    }

    this.meshes.forEach(m => {
        m.positionLast.copy(m.position)
        m.quaternionLast.copy(m.quaternion)
        m.scaleLast.copy(m.scale);
    });

    if(!this.dirtyPositions && !this.dirtyNormals && !this.dirtyIndices) return;

    var meshes = this.meshes;
    var geometry = this.geometry;
    var sa = this.supportedAttributes;
    var sas = this.supportedAttributeSizes;
    if(this.dirtyPositions || this.dirtyNormals || this.dirtyAll) {

        meshes.forEach( m => m.updateMatrixWorld());

        //recalculate buffer sizes
        sa.forEach(n => {
            sas[n] = meshes.reduce((total, mesh) => {
                return total + mesh.geometry.attributes[n].count;
            }, 0);
        });

        //allocate new sizes if necessary
        sa.forEach(n => {
            var attribute = geometry.attributes[n];
            if(attribute.count != sas[n]) {
                attribute.array = new attribute.array.constructor(sas[n] * attribute.itemSize);
                attribute.count = sas[n];
            }
        });

        //populate with data
        var cursor = 0;
        sa.forEach(n => {
            if((n == "position" && that.dirtyPositions) || (n == "normal" && that.dirtyNormals) || this.dirtyAll) {
                cursor = 0;
                var attribute = geometry.attributes[n];
                for(var i = 0; i < meshes.length; i++) {
                    var mesh = meshes[i];
                    var srcAttr = mesh.geometry.attributes[n];
                    copyAttrBufferArray(n, attribute.array, srcAttr.array, cursor, mesh.matrixWorld);
                    cursor += srcAttr.array.length;
                }
                attribute.needsUpdate = true;
            }
        });
        that.dirtyPositions = false;
        that.dirtyNormals = false;
    }

    if(this.dirtyIndices) {
        var totalIndices = meshes.reduce( (total, mesh) => {
            return total + mesh.geometry.index.count;
        }, 0);
        if( geometry.index.count != totalIndices) {
            geometry.index.array = new geometry.index.array.constructor(totalIndices);
            geometry.index.count = totalIndices;
        }

        cursor = 0;
        cursorPositions = 0;
        meshes.forEach(mesh => {
            var dstArr = geometry.index.array;
            var srcArr = mesh.geometry.index.array;
            for(var i = 0; i < srcArr.length; i++) {
                dstArr[cursor+i] = srcArr[i] + cursorPositions;
            }
            cursor += srcArr.length;
            cursorPositions += mesh.geometry.attributes.position.count;
        });

        geometry.index.needsUpdate = true;

        this.dirtyIndices = false;
    }

    this.dirtyAll = false;
}

function cloneEmptyAttribute(src, size = 1) {
    return new src.constructor(new src.array.constructor(size * src.itemSize), src.itemSize);
}

function addToBatch(mesh) {
    if(this.meshes.length == 0) {
        this.supportedAttributes = Object.keys(mesh.geometry.attributes);
        var sas = this.supportedAttributeSizes;
        var geometry = this.geometry;
        this.supportedAttributes.forEach(n => {
            sas[n] = 0;
            geometry.addAttribute(n, cloneEmptyAttribute(mesh.geometry.attributes[n]));
        });
        geometry.setIndex(cloneEmptyAttribute(mesh.geometry.index));
    }
    if(mesh.material !== this.material) throw new Error("Cannot batch Meshes that use different materials.");
    this.meshes.push(mesh);
    mesh.positionLast = mesh.position.clone();
    mesh.quaternionLast = mesh.quaternion.clone();
    mesh.scaleLast = mesh.scale.clone();
    mesh.visible = false;
    this.dirtyPositions = true;
    this.dirtyIndices = true;
    this.dirtyAll = true;
}

BatchingMesh.prototype = Object.create(three.Mesh.prototype);

extend(BatchingMesh.prototype, {
    onEnterFrame,
    addToBatch
});

module.exports = BatchingMesh;