/* eslint-disable max-len */
export class CountriesMocks {
    static readonly AfghanistanRegion1Name: string = 'Balkh Province';

    static readonly AfghanistanRegion1Code: string = 'BAL';

    static readonly AfghanistanRegion2Name: string = 'Bamyan Province';

    static readonly AfghanistanRegion2Code: string = 'BAM';

    static readonly AfghanistanRegion3Name: string = 'Badghis Province';

    static readonly AfghanistanRegion3Code: string = 'BDG';

    static readonly AfghanistanRegion1: string =
        '{"name":"Balkh Province","code":"BAL"}';

    static readonly AfghanistanRegion2: string =
        '{"name":"Bamyan Province","code":"BAM"}';

    static readonly AfghanistanRegion3: string =
        '{"name":"Badghis Province","code":"BDG"}';

    static readonly AfghanistanRegions: string = `[
        ${CountriesMocks.AfghanistanRegion1},
        ${CountriesMocks.AfghanistanRegion2},
        ${CountriesMocks.AfghanistanRegion3},
        {"name":"Badakhshan Province","code":"BDS"},
        {"name":"Baghlan Province","code":"BGL"},
        {"name":"Daykundi Province","code":"DAY"},
        {"name":"Farah Province","code":"FRA"},
        {"name":"Faryab Province","code":"FYB"},
        {"name":"Ghazni Province","code":"GHA"},
        {"name":"Ghōr Province","code":"GHO"},
        {"name":"Helmand Province","code":"HEL"},
        {"name":"Herat Province","code":"HER"},
        {"name":"Jowzjan Province","code":"JOW"},
        {"name":"Kabul Province","code":"KAB"},
        {"name":"Kandahar Province","code":"KAN"},
        {"name":"Kapisa Province","code":"KAP"},
        {"name":"Kunduz Province","code":"KDZ"},
        {"name":"Khost Province","code":"KHO"},
        {"name":"Kunar Province","code":"KNR"},
        {"name":"Laghman Province","code":"LAG"},
        {"name":"Logar Province","code":"LOG"},
        {"name":"Nangarhar Province","code":"NAN"},
        {"name":"Nimruz Province","code":"NIM"},
        {"name":"Nuristan Province","code":"NUR"},
        {"name":"Oruzgan","code":"ORU"},
        {"name":"Panjshir Province","code":"PAN"},
        {"name":"Parwan Province","code":"PAR"},
        {"name":"Paktia Province","code":"PIA"},
        {"name":"Paktika Province","code":"PKA"},
        {"name":"Samangan Province","code":"SAM"},
        {"name":"Sar-e Pol Province","code":"SAR"},
        {"name":"Takhar Province","code":"TAK"},
        {"name":"Urozgan Province","code":"URU"},
        {"name":"Maidan Wardak Province","code":"WAR"},
        {"name":"Zabul Province","code":"ZAB"}
    ]`;

    static readonly AfghanistanName: string = 'Afghanistan';

    static readonly AfghanistanCode: string = 'AF';

    static readonly AfghanistanCountry: string = `{"name":"${CountriesMocks.AfghanistanName}","code":"${CountriesMocks.AfghanistanCode}","regions":${CountriesMocks.AfghanistanRegions}}`;

    static readonly CountriesJson: string = `[
        ${CountriesMocks.AfghanistanCountry},
        {
            "name": "South Sudan",
            "code": "SS",
            "regions": [
                {"name":"Ruweng","code":""},
                {"name":"Maiwut","code":""},
                {"name":"Akobo","code":""},
                {"name":"Aweil","code":""},
                {"name":"Eastern Lakes","code":""},
                {"name":"Gogrial","code":""},
                {"name":"Lol","code":""},
                {"name":"Amadi State","code":""},
                {"name":"Yei River","code":""},
                {"name":"Fashoda","code":""},
                {"name":"Gok","code":""},
                {"name":"Tonj","code":""},
                {"name":"Twic","code":""},
                {"name":"Wau","code":""},
                {"name":"Gbudwe","code":""},
                {"name":"Imatong","code":""},
                {"name":"Jubek","code":""},
                {"name":"Maridi","code":""},
                {"name":"Terekeka","code":""},
                {"name":"Boma","code":""},
                {"name":"Bieh","code":""},
                {"name":"Central Upper Nile","code":""},
                {"name":"Latjoor","code":""},
                {"name":"Northern Liech","code":""},
                {"name":"Southern Liech","code":""},
                {"name":"Fangak","code":""},
                {"name":"Western Lakes","code":""},
                {"name":"Aweil East","code":""},
                {"name":"Northern Upper Nile","code":""},
                {"name":"Tambura","code":""},
                {"name":"Kapoeta","code":""},
                {"name":"Jonglei","code":"JG"}
            ]
        },
        {
            "name": "Kosovo",
            "code": "XK",
            "regions": []
        }
    ]`;
}
