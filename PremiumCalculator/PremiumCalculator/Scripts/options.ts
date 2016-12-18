namespace PremiumCalulator {
    "use strict";

    export interface ISettings {
        Mode: number;
    }

    export function InitOptions(): void {
        /* tslint:disable:no-unused-expression */
        new Options();
        /* tslint:enable:no-unused-expression */
    }

    export class Options {
        private WebExtension: boolean;
        private API: typeof chrome;
        private ModeSelect: HTMLSelectElement;

        public constructor() {
            this.WebExtension = typeof browser !== "undefined";
            this.API = this.WebExtension ? browser : chrome;

            this.ModeSelect = <HTMLSelectElement>document.getElementById("display-mode");
            this.Load();
            this.ModeSelect.addEventListener("change", (): void => { this.Save(); });
        }

        private Load(): void {
            if (this.WebExtension) {
                (<any>this.API.storage.local).get().then((settings_: ISettings[]) => {
                    var settings = settings_.length > 0 ? settings_[0] : { Mode: 1 }; //Not sure why it returns an array, the docs doesn't say it does.
                    this.ModeSelect.value = settings.Mode.toString();
                });
            } else {
                this.API.storage.sync.get(<ISettings>{
                    Mode: 1
                }, (settings: ISettings): void => {
                    this.ModeSelect.value = settings.Mode.toString();
                });
            }
        }

        private Save(): void {
            if (this.WebExtension) {
                (<any>this.API.storage.local).set({
                    Mode: parseInt(this.ModeSelect.value, 10)
                });
            } else {
                this.API.storage.sync.set(<ISettings>{
                    Mode: parseInt(this.ModeSelect.value, 10)
                });
            }
        }
    }
}

PremiumCalulator.InitOptions();
