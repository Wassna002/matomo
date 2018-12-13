/*!
 * Piwik - free/libre analytics platform
 *
 * Screenshot integration tests.
 *
 * @link http://piwik.org
 * @license http://www.gnu.org/licenses/gpl-3.0.html GPL v3 or later
 */

describe("TwoFactorAuth", function () {
    this.timeout(0);

    this.fixture = "Piwik\\Plugins\\TwoFactorAuth\\tests\\Fixtures\\TwoFactorFixture";

    var generalParams = 'idSite=1&period=day&date=2010-01-03',
        userSettings = '?module=UsersManager&action=userSettings&' + generalParams,
        logoutUrl = '?module=Login&action=logout&period=day&date=yesterday';


    async function selectModalButton(button)
    {
        await page.click('.modal.open .modal-footer a:contains('+button+')');
    }

    async function loginUser(username, doAuth)
    {
        // make sure to log out previous session
        await page.goto(logoutUrl);

        if (typeof doAuth === 'undefined') {
            doAuth = true;
        }
        var logMeUrl = '?module=Login&action=logme&login=' + username + '&password=240161a241087c28d92d8d7ff3b6186b';
        if (doAuth) {
            logMeUrl += '&authCode=123456'; // we make sure in test config this code always works
        }
        await page.waitFor(1000);
        await page.goto(logMeUrl);
    }

    function requireTwoFa() {
        testEnvironment.requireTwoFa = 1;
        testEnvironment.save();
    }

    function fakeCorrectAuthCode() {
        testEnvironment.fakeCorrectAuthCode = 1;
        testEnvironment.save();
    }

    before(function () {
        testEnvironment.pluginsToLoad = ['TwoFactorAuth'];
        testEnvironment.queryParamOverride = { date: '2018-03-04' };
        testEnvironment.save();
    });

    beforeEach(function () {
        testEnvironment.testUseMockAuth = 0;
        testEnvironment.restoreRecoveryCodes = 1;
        testEnvironment.save();
    });

    afterEach(function () {
        delete testEnvironment.requireTwoFa;
        delete testEnvironment.restoreRecoveryCodes;
        delete testEnvironment.fakeCorrectAuthCode;
        testEnvironment.testUseMockAuth = 1;
        testEnvironment.save();
    });

    async function confirmPassword()
    {
        await page.waitFor(1000);
        await page.type('.confirmPasswordForm #login_form_password', '123abcDk3_l3');
        await page.click('.confirmPasswordForm #login_form_submit');
    }

    async function captureScreen(screenshotName, selector) {
        if (!selector) {
            selector = '.loginSection,#content,#notificationContainer';
        }

        expect(await page.screenshotSelector(selector)).to.matchImage(screenshotName);
    }

    async function captureUserSettings(screenshotName) {
        await captureScreen(screenshotName, '.userSettings2FA');
    }

    async function captureModal(screenshotName, test) {
        await captureScreen(screenshotName, test, '.modal.open');
    }

    it('a user with 2fa can open the widgetized view by token without needing to verify', async function () {
        await page.goto('?module=Widgetize&action=iframe&moduleToWidgetize=Actions&actionToWidgetize=getPageUrls&date=2018-03-04&token_auth=c4ca4238a0b923820dcc509a6f75849b&' + generalParams);
        await captureScreen('widgetized_no_verify');
    });

    it('when logging in through logme and not providing auth code it should show auth code screen', async function () {
        await loginUser('with2FA', false);
        await captureScreen('logme_not_verified');
    });

    it('when logging in and providing wrong code an error is shown', async function () {
        await page.type('.loginTwoFaForm #login_form_authcode', '555555');
        await page.click('.loginTwoFaForm #login_form_submit');
        await captureScreen('logme_not_verified_wrong_code');
    });

    it('when logging in through logme and verifying screen it works to access ui', async function () {
        await page.type('.loginTwoFaForm #login_form_authcode', '123456');
        await page.click('.loginTwoFaForm #login_form_submit');
        await captureScreen('logme_verified');
    });

    it('should show user settings when two-fa enabled', async function () {
        await loginUser('with2FA');
        await page.goto(userSettings);
        await captureUserSettings('usersettings_twofa_enabled');
    });

    it('should be possible to show recovery codes step1 authentication', async function () {
        await page.click('.showRecoveryCodesLink');
        await captureScreen('show_recovery_codes_step1');
    });

    it('should be possible to show recovery codes step2 done', async function () {
        await confirmPassword();
        await captureScreen('show_recovery_codes_step2');
    });

    it('should show user settings when two-fa enabled', async function () {
        requireTwoFa();
        await page.goto(userSettings);
        await captureUserSettings('usersettings_twofa_enabled_required');
    });

    it('should be possible to disable two factor', async function () {
        await loginUser('with2FADisable');
        await page.goto(userSettings);
        await page.click('.disable2FaLink');
        await captureModal('usersettings_twofa_disable_step1');
    });

    it('should be possible to disable two factor step 2 confirmed', async function () {
        await selectModalButton('Yes');
        await captureScreen('usersettings_twofa_disable_step2');
    });

    it('should be possible to disable two factor step 3 verified', async function () {
        await confirmPassword();
        await captureUserSettings('usersettings_twofa_disable_step3');
    });

    it('should show setup screen - step 1', async function () {
        await loginUser('without2FA');
        await page.goto(userSettings);
        await page.click('.enable2FaLink');
        await confirmPassword();
        await captureScreen('twofa_setup_step1');
    });

    it('should move to second step in setup - step 2', async function () {
        await page.click('.setupTwoFactorAuthentication .backupRecoveryCode:first');
        await page.click('.setupTwoFactorAuthentication .goToStep2');
        await page.evaluate(function () {
            $('#qrcode').hide();
        });
        await captureScreen('twofa_setup_step2');
    });

    it('should move to third step in setup - step 3', async function () {
        await page.click('.setupTwoFactorAuthentication .goToStep3');
        await captureScreen('twofa_setup_step3');
    });

    it('should move to third step in setup - step 4 confirm', async function () {
        fakeCorrectAuthCode();
        await page.type('.setupConfirmAuthCodeForm input[type=text]', '123458');
        await page.evaluate(function () {
            $('.setupConfirmAuthCodeForm input[type=text]').change();
        });
        await page.evaluate(function () {
            $('.setupConfirmAuthCodeForm .confirmAuthCode').click();
        });
        await captureScreen('twofa_setup_step4');
    });

    it('should force user to setup 2fa when not set up yet but enforced', async function () {
        requireTwoFa();
        await loginUser('no2FA', false);
        await captureScreen('twofa_forced_step1');
    });

    it('should force user to setup 2fa when not set up yet but enforced step 2', async function () {
        await page.click('.setupTwoFactorAuthentication .backupRecoveryCode:first');
        await page.click('.setupTwoFactorAuthentication .goToStep2');
        await captureScreen('twofa_forced_step2');
    });

    it('should force user to setup 2fa when not set up yet but enforced step 3', async function () {
        await captureScreen('twofa_forced_step3', async function () {
            await page.click('.setupTwoFactorAuthentication .goToStep3');
        });
    });
    it('should force user to setup 2fa when not set up yet but enforced confirm code', async function () {
        requireTwoFa();
        fakeCorrectAuthCode();
        await page.type('.setupConfirmAuthCodeForm input[type=text]', '123458');
        await page.evaluate(function () {
            $('.setupConfirmAuthCodeForm input[type=text]').change();
        });
        await page.evaluate(function () {
            $('.setupConfirmAuthCodeForm .confirmAuthCode').click();
        });
        await captureScreen('twofa_forced_step4');
    });

});