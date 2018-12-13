/*!
 * Piwik - free/libre analytics platform
 *
 * Screenshot integration tests.
 *
 * @link http://piwik.org
 * @license http://www.gnu.org/licenses/gpl-3.0.html GPL v3 or later
 */

describe("TwoFactorAuthUsersManager", function () {
    this.timeout(0);

    this.fixture = "Piwik\\Plugins\\TwoFactorAuth\\tests\\Fixtures\\TwoFactorUsersManagerFixture";

    var generalParams = 'idSite=1&period=day&date=2010-01-03',
        usersManager = '?module=UsersManager&action=index&' + generalParams;

    before(function () {
        testEnvironment.pluginsToLoad = ['TwoFactorAuth'];
        testEnvironment.save();
    });


    async function captureScreen(screenshotName, test, selector) {
        if (!selector) {
            selector = '#content,#notificationContainer';
        }

        await test();

        expect(await page.screenshotSelector(selector)).to.matchImage(screenshotName);
    }

    async function captureModal(screenshotName, test) {
        await captureScreen(screenshotName, test, '.modal.open');
    }

    it('shows users with 2fa and not 2fa', async function () {
        await captureScreen('list', async function () {
            await page.goto(usersManager);
            await page.evaluate(function () {
                $('td#last_seen').html(''); // fix random test failure
            });
        });
    });

    it('menu should show 2fa tab', async function () {
        await captureScreen('edit_with_2fa', async function () {
            await page.webpage.setViewport({
                width: 1250,
                height: 768
            });
            await page.click('#manageUsersTable #row2 .edituser');
            await page.evaluate(function () {
                $('.userEditForm .menuUserTwoFa a').click();
            });
        });
    });

    it('should ask for confirmation before resetting 2fa', async function () {
        await captureModal('edit_with_2fa_reset_confirm', async function () {
            await page.click('.userEditForm .twofa-reset .resetTwoFa .btn');
        });
    });

    it('should be possible to confirm the reset', async function () {
        await captureScreen('edit_with_2fa_reset_confirmed', async function () {
            await page.click('.twofa-confirm-modal .modal-close:not(.modal-no)');
        });
    });

});