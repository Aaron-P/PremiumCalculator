//TODO: Add error throw/catch and show a message to the user to report it
//TODO: Determine # available?

interface IBackgroundMessage {
    update: string;
}

namespace Utils {
    "use strict";

    export function MatchPattern(pattern: string): RegExp {
        if (pattern === "<all_urls>")
            return /^(?:https?|file|ftp):\/\/.*/;

        var split = /^(\*|https?|file|ftp):\/\/(.*)$/.exec(pattern);
        if (split == null)
            throw new Error("Invalid schema in pattern: " + pattern);
        var schema = split[1];
        var fullpath = split[2];

        split = /^([^\/]*)\/(.*)$/.exec(fullpath);
        if (split == null)
            throw new Error("No path specified in pattern: " + pattern);
        var host = split[1];
        var path = split[2];

        if (schema === "file" && host !== "")
            throw new Error("Non-empty host for file schema in pattern: " + pattern);

        if (schema !== "file" && host === "")
            throw new Error("No host specified in pattern: " + pattern);

        if (!(/^(\*|\*\.[^*]+|[^*]*)$/.exec(host)))
            throw new Error("Illegal wildcard in host in pattern: " + pattern);

        var reString = "^";
        reString += (schema === "*") ? "https?" : schema;
        reString += ":\\/\\/";
        reString += host.replace(/\*\.?/, "[^\\/]*");
        reString += "(:\\d+)?";
        reString += "\\/";
        reString += path.replace("*", ".*");
        reString += "$";

        return RegExp(reString);
    }
}

namespace PremiumCalulator {
    "use strict";

    const NON_NUMERIC: RegExp = /[^0-9\.]+/g;

    export enum Mode {
        PremiumPerProduct = 1,
        PremiumPerOZT = 2,
        SpotPrice = 3
    }

    export function Init(api: typeof chrome, settings: ISettings) {
        /* tslint:disable:no-unused-expression */
        if (Utils.MatchPattern("*://www.apmex.com/product/*").test(document.location.href))
            new APMEX(api, settings);
        if (Utils.MatchPattern("*://www.providentmetals.com/*").test(document.location.href))
            new Provident(api, settings);
                /* tslint:enable:no-unused-expression */
    }

    //TODO: Check domain in constructor?
    export class APMEX  {
        private API: typeof chrome;
        private PriceBox: HTMLTableSectionElement;
        private Settings: ISettings;
        private SpecsBox: HTMLDivElement;
        private SpotBox: HTMLSpanElement;

        public constructor(api: typeof chrome, settings: ISettings) {
            this.API = api;
            this.Settings = settings;

            if (this.IsProductPage()) {
                this.PriceBox = <HTMLTableSectionElement>document.querySelector("table.table-volume-pricing > tbody");
                if (this.PriceBox === null)
                    throw new Error("Price table not found.");

                this.SpecsBox = <HTMLDivElement>document.querySelector("div.product-specifications");
                if (this.SpecsBox === null)
                    throw new Error("Specification box not found.");

                this.SpotBox = <HTMLSpanElement>document.querySelector("table.table-spot-prices span.item-bid");
                if (this.SpotBox === null)
                    throw new Error("Spot price box not found.");

                this.InsertPremiums();
            }
        }

        private GetMetalContent(): number {
            var contentLabel: HTMLDivElement[] = Array.prototype.filter.call(this.SpecsBox.querySelectorAll("div.spec-name"), (element: HTMLDivElement) => element.innerText === "Metal Content:");
            if (contentLabel.length === 0)
                return;

            var contentValue = (<HTMLDivElement>(contentLabel[0].nextElementSibling)).innerText;
            if (contentValue.indexOf("troy oz") > -1)
                return parseFloat(contentValue.replace(NON_NUMERIC, ""));

            //TODO: Do they ever show anything but troy ounces?
        }

        private GetMetalSpot(): number {
            return parseFloat(this.SpotBox.innerText.replace(NON_NUMERIC, ""));
        }

        private GetPremium(price: number): number {
            var content = this.GetMetalContent();
            var spot = this.GetMetalSpot();
            if (content == null || spot == null)
                return;

            switch (this.Settings.Mode) {
                default:
                case Mode.PremiumPerProduct:
                    return price - (spot * content);
                case Mode.PremiumPerOZT:
                    return content === 0 ? 0 : (price / content) - spot;
                case Mode.SpotPrice:
                    return spot * content;
            }
        }

        //TODO: Premium on product vs premium per ozt?
        private InsertPremiums(): void {
            Array.prototype.map.call(this.PriceBox.getElementsByTagName("tr"), (element: HTMLTableRowElement) => {
                var cash = element.getElementsByTagName("td")[1];
                var cashPrice = parseFloat(cash.innerText.replace(NON_NUMERIC, ""));
                cash.innerText += " ($" + this.GetPremium(cashPrice).toFixed(2) + ")";

                var credit = element.getElementsByTagName("td")[2];
                var creditPrice = parseFloat(credit.innerText.replace(NON_NUMERIC, ""));
                credit.innerText += " ($" + this.GetPremium(creditPrice).toFixed(2) + ")";
            });
        }

        private IsProductPage(): boolean {
            return window.location.pathname.indexOf("/product/") === 0;
        }
    }

    export class Provident {
        private API: typeof chrome;
        private PriceBox: HTMLTableElement;
        private Settings: ISettings;
        private SpecsBox: HTMLTableSectionElement;
        private SpotBox: HTMLSpanElement;

        public constructor(api: typeof chrome, settings: ISettings) {
            this.API = api;
            this.Settings = settings;

            if (this.IsProductPage()) {
                //The <tbody> gets replaced when the prices update, so we can't go lower here.
                this.PriceBox = <HTMLTableElement>document.querySelector("table.pricing-table");
                if (this.PriceBox === null)
                    throw new Error("Price table not found.");

                this.SpecsBox = <HTMLTableSectionElement>document.querySelector("#product-attribute-specs-table > tbody");
                if (this.SpecsBox === null)
                    throw new Error("Specification box not found.");

                this.SpotBox = <HTMLSpanElement>document.querySelector("div.metal-prices span.spot-price-bid > span.price");
                if (this.SpotBox === null)
                    throw new Error("Spot price box not found.");

                //TODO: Do API calls directly? Might cause a loop with our handler, and I would rather not double-request.
                this.InsertPremiums();
                this.API.runtime.onMessage.addListener((message: IBackgroundMessage, sender: any) => {
                    if (sender.tab != null)
                        throw new Error("Message not from background script.");

                    //We need to wait until their scripts have updated the elements.  Not sure how long that takes.
                    if (message.update === "product")
                        setTimeout(() => { this.InsertPremiums(); }, 200);

                    //When the spot price updates independently of the product prices,
                    //it doesn't seem to reflect the underlying price of the item.
                    //Updating it based on a spot price update makes it seem higher/lower than it is.
                    //if (message.update === "spot")
                    //    setTimeout(() => { this.UpdatePremiums(); }, 200);
                });
            }
        }

        private GetMetalContent(): number {
            var contentLabel: HTMLDivElement[] = Array.prototype.filter.call(this.SpecsBox.querySelectorAll("th.label"), (element: HTMLTableHeaderCellElement) => /^(Silver|Gold|Platinum) Content$/.test(element.innerText));
            if (contentLabel.length === 0)
                return;

            var contentValue = (<HTMLTableCellElement>(contentLabel[0].nextElementSibling)).innerText;
            if (contentValue.indexOf("troy oz") > -1)
                return parseFloat(contentValue.replace(NON_NUMERIC, ""));
        }

        private GetMetalSpot(): number {
            return parseFloat(this.SpotBox.innerText.replace(NON_NUMERIC, ""));
        }

        private GetPremium(price: number): number {
            var content = this.GetMetalContent();
            var spot = this.GetMetalSpot();
            if (content == null || spot == null)
                return;

            switch (this.Settings.Mode) {
                default:
                case Mode.PremiumPerProduct:
                    return price - (spot * content);
                case Mode.PremiumPerOZT:
                    return content === 0 ? 0 : (price / content) - spot;
                case Mode.SpotPrice:
                    return spot * content;
            }
        }

        private InsertPremiums(): void {
            Array.prototype.filter.call(this.PriceBox.querySelectorAll("tbody > tr"), (element: HTMLTableRowElement) => {
                var cash = element.getElementsByTagName("td")[1];
                var cashPrice = parseFloat(cash.innerText.replace(NON_NUMERIC, ""));
                //cash.dataset["text"] = cash.innerText;
                cash.innerText += " ($" + this.GetPremium(cashPrice).toFixed(2) + ")";

                var bitcoin = element.getElementsByTagName("td")[2];
                var bitcoinPrice = parseFloat(bitcoin.innerText.replace(NON_NUMERIC, ""));
                //bitcoin.dataset["text"] = bitcoin.innerText;
                bitcoin.innerText += " ($" + this.GetPremium(bitcoinPrice).toFixed(2) + ")";

                var credit = element.getElementsByTagName("td")[3];
                var creditPrice = parseFloat(credit.innerText.replace(NON_NUMERIC, ""));
                //credit.dataset["text"] = credit.innerText;
                credit.innerText += " ($" + this.GetPremium(creditPrice).toFixed(2) + ")";
            });
        }

        //private UpdatePremiums(): void {
        //    var value = this.GetMetalValue();

        //    Array.prototype.filter.call(this.priceBox.querySelectorAll("tbody > tr"), (element: HTMLTableRowElement) => {
        //        var cash = element.getElementsByTagName("td")[1];
        //        var cashPrice = parseFloat(cash.innerText.replace(NON_NUMERIC, ""));
        //        if (cash.dataset["text"] != null)
        //            cash.innerText = cash.dataset["text"] + " ($" + (cashPrice - value).toFixed(2) + ")";

        //        var bitcoin = element.getElementsByTagName("td")[2];
        //        var bitcoinPrice = parseFloat(bitcoin.innerText.replace(NON_NUMERIC, ""));
        //        if (bitcoin.dataset["text"] != null)
        //            bitcoin.innerText = bitcoin.dataset["text"] + " ($" + (bitcoinPrice - value).toFixed(2) + ")";

        //        var credit = element.getElementsByTagName("td")[3];
        //        var creditPrice = parseFloat(credit.innerText.replace(NON_NUMERIC, ""));
        //        if (credit.dataset["text"] != null)
        //            credit.innerText = credit.dataset["text"] + " ($" + (creditPrice - value).toFixed(2) + ")";
        //    });
        //}

        private IsProductPage(): boolean {
            return document.querySelector("input[type='hidden'][name='sku']") !== null;
        }
    }
}

(function () {
    var webExtension = typeof browser !== "undefined";
    var api = webExtension ? browser : chrome;

    if (webExtension) {
        (<any>api.storage.local).get().then((settings: PremiumCalulator.ISettings[]) => { //Not sure why it returns an array, the docs doesn't say it does.
            PremiumCalulator.Init(api, settings.length > 0 ? settings[0] : { Mode: 1 });
        });
    } else {
        api.storage.sync.get(<PremiumCalulator.ISettings>{
            Mode: 1
        }, (settings: PremiumCalulator.ISettings): void => {
            PremiumCalulator.Init(api, settings);
        });
    }
} ());
