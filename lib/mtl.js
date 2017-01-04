'use strict';
var byline = require('byline');
var fsExtra = require('fs-extra');
var Promise = require('bluebird');

module.exports = loadMtl;

function Material() {
    this.ambientColor = undefined;               // Ka
    this.emissionColor = undefined;              // Ke
    this.diffuseColor = undefined;               // Kd
    this.specularColor = undefined;              // Ks
    this.specularShininess = undefined;          // Ns
    this.alpha = undefined;                      // d / Tr
    this.ambientColorMap = undefined;            // map_Ka
    this.emissionColorMap = undefined;           // map_Ke
    this.diffuseColorMap = undefined;            // map_Kd
    this.specularColorMap = undefined;           // map_Ks
    this.specularShininessMap = undefined;       // map_Ns
    this.normalMap = undefined;                  // map_Bump
    this.alphaMap = undefined;                   // map_d
}

function loadMtl(mtlPath) {
    var material;
    var values;
    var value;
    var materials = {};

    return new Promise(function(resolve) {
        var stream = byline(fsExtra.createReadStream(mtlPath, {encoding: 'utf8'}));
        stream.on('data', function (line) {
            line = line.trim();
            if (/^newmtl /i.test(line)) {
                var name = line.substring(7).trim();
                material = new Material();
                materials[name] = material;
            } else if (/^Ka /i.test(line)) {
                values = line.substring(3).trim().split(' ');
                material.ambientColor = [
                    parseFloat(values[0]),
                    parseFloat(values[1]),
                    parseFloat(values[2]),
                    1.0
                ];
            } else if (/^Ke /i.test(line)) {
                values = line.substring(3).trim().split(' ');
                material.emissionColor = [
                    parseFloat(values[0]),
                    parseFloat(values[1]),
                    parseFloat(values[2]),
                    1.0
                ];
            } else if (/^Kd /i.test(line)) {
                values = line.substring(3).trim().split(' ');
                material.diffuseColor = [
                    parseFloat(values[0]),
                    parseFloat(values[1]),
                    parseFloat(values[2]),
                    1.0
                ];
            } else if (/^Ks /i.test(line)) {
                values = line.substring(3).trim().split(' ');
                material.specularColor = [
                    parseFloat(values[0]),
                    parseFloat(values[1]),
                    parseFloat(values[2]),
                    1.0
                ];
            } else if (/^Ns /i.test(line)) {
                value = line.substring(3).trim();
                material.specularShininess = parseFloat(value);
            } else if (/^d /i.test(line)) {
                value = line.substring(2).trim();
                material.alpha = parseFloat(value);
            } else if (/^Tr /i.test(line)) {
                value = line.substring(3).trim();
                material.alpha = parseFloat(value);
            } else if (/^map_Ka /i.test(line)) {
                material.ambientColorMap = line.substring(7).trim();
            } else if (/^map_Ke /i.test(line)) {
                material.emissionColorMap = line.substring(7).trim();
            } else if (/^map_Kd /i.test(line)) {
                material.diffuseColorMap = line.substring(7).trim();
            } else if (/^map_Ks /i.test(line)) {
                material.specularColorMap = line.substring(7).trim();
            } else if (/^map_Ns /i.test(line)) {
                material.specularShininessMap = line.substring(7).trim();
            } else if (/^map_Bump /i.test(line)) {
                material.normalMap = line.substring(9).trim();
            } else if (/^map_d /i.test(line)) {
                material.alphaMap = line.substring(6).trim();
            }
        });

        stream.on('end', function () {
            resolve(materials);
        });

        stream.on('error', function () {
            console.log('Could not read material file at ' + mtlPath + '. Using default material instead.');
            resolve({});
        });
    });
}
