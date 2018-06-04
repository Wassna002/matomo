/*!
 * Piwik - free/libre analytics platform
 *
 * chai assertion extensions
 *
 * @link http://piwik.org
 * @license http://www.gnu.org/licenses/gpl-3.0.html GPL v3 or later
 */

var fs = require('fs'),
    fsExtra = require('fs-extra'),
    path = require('path'),
    chai = require('chai'),
    AssertionError = chai.AssertionError;
const { spawnSync } = require('child_process');

/**
 * Returns a chai plugin that adds the `.matchImage` assertion.
 *
 * Usage:
 *
 * var baseFilePath = '...';
 * chai.use(require('chai-image-assert')(baseFilePath));
 *
 */
module.exports = function makeChaiImageAssert(comparisonCommand = 'compare') {
    return function chaiImageAssert(chai, utils) {
        chai.Assertion.addMethod('matchImage', matchImage);

        function matchImage(params) {
            if (typeof params === 'string') {
                params = { imageName: params };
            }

            let { imageName, compareAgainst, comparisonThreshold, prefix } = params;

            if (!prefix) {
                prefix = app.runner.suite.title; // note: runner is made global by run-tests.js
            }

            imageName = prefix + '_' + imageName;

            compareAgainst = compareAgainst || imageName;

            imageName = assumeFileIsImageIfNotSpecified(imageName);
            compareAgainst = assumeFileIsImageIfNotSpecified(compareAgainst);

            const expectedPath = getExpectedFilePath(compareAgainst),
                processedPath = getProcessedFilePath(imageName);

            const processedScreenshotsPath = path.dirname(processedPath);

            if (!fs.isDirectory(processedScreenshotsPath)) {
                fs.mkdirSync(processedScreenshotsPath);
            }

            const imageBuffer = this._obj;

            chai.assert.instanceOf(imageBuffer, Buffer);
            fs.writeFileSync(processedPath, imageBuffer);

            try {
                if (!fs.isFile(expectedPath)) {
                    app.appendMissingExpected(imageName);
                    this.assert(false, `expected file at '${expectedPath}' does not exist`);
                } else {
                    this.assert(
                        compareImages(expectedPath, processedPath, comparisonThreshold),
                        `expected screenshot to match ${expectedPath}`,
                        `expected screenshot to not match ${expectedPath}`
                    );

                    performAutomaticPageChecks();
                }
            } catch (e) {
                fail(e.message);
            }

            function fail(message) {
                var testInfo = {
                    name: imageName,
                    processed: fs.isFile(processedPath) ? processedPath : null,
                    expected: fs.isFile(expectedPath) ? expectedPath : null,
                    baseDirectory: app.runner.suite.baseDirectory
                };

                var expectedPathStr = testInfo.expected ? path.resolve(testInfo.expected) : (expectedPath + " (not found)"),
                    processedPathStr = testInfo.processed ? path.resolve(testInfo.processed) : (processedPath + " (not found)");

                var indent = "     ";
                var failureInfo = message + "\n";
                failureInfo += indent + "Url to reproduce: " + page.url() + "\n";
                failureInfo += indent + "Generated screenshot: " + processedPathStr + "\n";
                failureInfo += indent + "Expected screenshot: " + expectedPathStr + "\n";

                failureInfo += getPageLogsString(page.pageLogs, indent);

                var error = new AssertionError(message);

                // stack traces are useless so we avoid the clutter w/ this
                error.stack = failureInfo;

                throw error;
            }
        }

        function compareImages(expectedPath, processedPath, comparisonThreshold) {
            const command = comparisonCommand,
                args = [
                    '-metric',
                    'ae',
                    expectedPath,
                    processedPath,
                    'null:'
                ];

            const result = spawnSync(command, args);

            chai.assert(!isCommandNotFound(result),
                `the '${comparisonCommand}' command was not found, ('compare' is provided by imagemagick)`);

            if (result.status !== 0) {
                return false;
            }

            const allOutput = result.stdout.toString() + result.stderr.toString();
            const pixelError = parseInt(allOutput);
            chai.assert(!isNaN(pixelError),
                `the '${comparisonCommand}' command output could not be parsed, should be` +
                ` an integer, got: ${allOutput}`);

            const isSame = pixelError === 0;
            if (isSame) {
                return isSame;
            }

            if (comparisonThreshold) {
                // TODO: comparisonThreshold not implemented
                /*
                isSame = misMatchPercentage <= 100 * (1 - comparisonThreshold);

                // we use image magick only for exact match comparison, if there is a threshold we now check if this one fails
                resemble("file://" + processedScreenshotPath).compareTo("file://" + expectedScreenshotPath).onComplete(function(data) {
                    if (!screenshotMatches(data.misMatchPercentage)) {
                        fail(testFailure + ". (mismatch = " + data.misMatchPercentage + ")");
                        return;
                    }

                    pass();
                });
                */
            }

            return isSame;
        }
    };
};

function isCommandNotFound(result) {
    return result.status === 127
        || (result.error != null && result.error.code === 'ENOENT');
}

function getExpectedScreenshotPath() {
    if (typeof config.expectedScreenshotsDir === 'string') {
        config.expectedScreenshotsDir = [config.expectedScreenshotsDir];
    }
    for (var dir in config.expectedScreenshotsDir) {
        var expectedScreenshotDir = path.join(app.runner.suite.baseDirectory, config.expectedScreenshotsDir[dir]);
        if (fs.isDirectory(expectedScreenshotDir)) {
            break;
        }
    }

    return expectedScreenshotDir;
}

function getExpectedFilePath(fileName) {
    fileName = assumeFileIsImageIfNotSpecified(fileName);

    return path.join(getExpectedScreenshotPath(), fileName);
}

function getProcessedFilePath(fileName) {
    var pathToUITests = options['store-in-ui-tests-repo'] ? uiTestsDir : app.runner.suite.baseDirectory;
    var processedScreenshotDir = path.join(pathToUITests, config.processedScreenshotsDir);

    if (!fs.isDirectory(processedScreenshotDir)) {
        fsExtra.mkdirsSync(processedScreenshotDir);
    }
    fileName = assumeFileIsImageIfNotSpecified(fileName);

    return path.join(processedScreenshotDir, fileName);
}

function assumeFileIsImageIfNotSpecified(filename) {
    if(!endsWith(filename, '.png') && !endsWith(filename, '.txt') ) {
        return filename + '.png';
    }
    return filename;
}

function endsWith(string, needle)
{
    return string.substr(-1 * needle.length, needle.length) === needle;
}

function getPageLogsString(pageLogs, indent) {
    var result = "";
    if (pageLogs.length) {
        result = "\n\n" + indent + "Rendering logs:\n";
        pageLogs.forEach(function (message) {
            result += indent + "  " + message.replace(/\n/g, "\n" + indent + "  ") + "\n";
        });
        result = result.substring(0, result.length - 1);
    }
    return result;
}


// other automatically run assertions
function performAutomaticPageChecks() {
    checkForDangerousLinks();
}

function checkForDangerousLinks() {
    var links = pageRenderer.webpage.evaluate(function () {
        try {
            var result = [];

            var linkElements = document.getElementsByTagName('a');
            for (var i = 0; i !== linkElements.length; ++i) {
                var element = linkElements.item(i);

                var href = element.getAttribute('href');
                if (/^(javascript|vbscript|data):/.test(href) && !isWhitelistedJavaScript(href)) {
                    result.push(element.innerText + ' - [href = ' + href + ']');
                }
            }

            return JSON.stringify(result);
        } catch (e) {
            return e.message || e;
        }

        function isWhitelistedJavaScript(href) {
            var whitelistedCode = [
                '',
                'void(0)',
                'window.history.back()',
                'window.location.reload()',
            ];

            var m = /^javascript:(.*?);*$/.exec(href);
            if (!m) {
                return false;
            }

            var code = m[1] || '';
            return whitelistedCode.indexOf(code) !== -1;
        }
    });
    expect(links, "found dangerous links").to.equal("[]");
}