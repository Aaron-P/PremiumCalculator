namespace PremiumCalulator {
    "use strict";

    export function InitBackground(): void {
        /* tslint:disable:no-unused-expression */
        new ProvidentBackground();
        /* tslint:enable:no-unused-expression */
    }

    export class ProvidentBackground {
        private WebExtension: boolean;
        private API: typeof chrome;

        public constructor() {
            this.WebExtension = typeof browser !== "undefined";
            this.API = this.WebExtension ? browser : chrome;

            //We can't modify the response so we need to alter the DOM after the request is complete.
            this.API.webRequest.onCompleted.addListener((details: any) => {
                if (details.statusCode === 200) {
                    this.API.tabs.sendMessage(details.tabId, { update: "product" });
                }
            }, { urls: ["*://www.providentmetals.com/services/products.php?type=product&sku=*"], types: ["xmlhttprequest"] });
            //["*://www.providentmetals.com/services/spot/*-detail.USD.json"] //spot update
        }
    }
}

PremiumCalulator.InitBackground();
