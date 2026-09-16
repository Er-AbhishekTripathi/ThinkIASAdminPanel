import {
  MAT_SELECT_CONFIG,
  MAT_SELECT_SCROLL_STRATEGY,
  MAT_SELECT_SCROLL_STRATEGY_PROVIDER,
  MAT_SELECT_SCROLL_STRATEGY_PROVIDER_FACTORY,
  MAT_SELECT_TRIGGER,
  MatSelect,
  MatSelectChange,
  MatSelectModule,
  MatSelectTrigger
} from "./chunk-WOCRZ3KX.js";
import "./chunk-PNBPZWAX.js";
import "./chunk-4AB6L44I.js";
import {
  MatOptgroup,
  MatOption
} from "./chunk-53EUIIOO.js";
import "./chunk-SFWXT5PA.js";
import "./chunk-ICBXV4SQ.js";
import {
  MatError,
  MatFormField,
  MatHint,
  MatLabel,
  MatPrefix,
  MatSuffix
} from "./chunk-5NIHPFCM.js";
import "./chunk-27WLDBV3.js";
import "./chunk-7ZKN34FJ.js";
import "./chunk-LJXVOCKR.js";
import "./chunk-NGQPOIAT.js";
import "./chunk-FGCGUHBV.js";
import "./chunk-XPINALN4.js";
import "./chunk-L26OKMS3.js";
import "./chunk-ARSML4I3.js";
import "./chunk-42FJBLFI.js";
import "./chunk-JXBCBRYI.js";
import "./chunk-J7RSWCSH.js";
import "./chunk-HGCOSP5V.js";
import "./chunk-5JTWY7VZ.js";
import "./chunk-TJIKXFFH.js";
import "./chunk-2O4WY5GE.js";
import "./chunk-PLXGWE6Z.js";
import "./chunk-YNQLHEXJ.js";
import "./chunk-IWWLXIFB.js";
import "./chunk-C7M6BWI4.js";
import "./chunk-FWYGTLMJ.js";
import "./chunk-XBXSB2TE.js";
import "./chunk-LNI3FMHN.js";
import "./chunk-Q7NVBPF5.js";
import "./chunk-WMWTRTCA.js";
import "./chunk-QO67QQ3F.js";
import "./chunk-PADBOZH3.js";
import "./chunk-UKK5MWW6.js";

// node_modules/@angular/material/fesm2022/select.mjs
var matSelectAnimations = {
  // Represents
  // trigger('transformPanelWrap', [
  //   transition('* => void', query('@transformPanel', [animateChild()], {optional: true})),
  // ])
  /**
   * This animation ensures the select's overlay panel animation (transformPanel) is called when
   * closing the select.
   * This is needed due to https://github.com/angular/angular/issues/23302
   */
  transformPanelWrap: {
    type: 7,
    name: "transformPanelWrap",
    definitions: [{
      type: 1,
      expr: "* => void",
      animation: {
        type: 11,
        selector: "@transformPanel",
        animation: [{
          type: 9,
          options: null
        }],
        options: {
          optional: true
        }
      },
      options: null
    }],
    options: {}
  },
  // Represents
  // trigger('transformPanel', [
  //   state(
  //     'void',
  //     style({
  //       opacity: 0,
  //       transform: 'scale(1, 0.8)',
  //     }),
  //   ),
  //   transition(
  //     'void => showing',
  //     animate(
  //       '120ms cubic-bezier(0, 0, 0.2, 1)',
  //       style({
  //         opacity: 1,
  //         transform: 'scale(1, 1)',
  //       }),
  //     ),
  //   ),
  //   transition('* => void', animate('100ms linear', style({opacity: 0}))),
  // ])
  /** This animation transforms the select's overlay panel on and off the page. */
  transformPanel: {
    type: 7,
    name: "transformPanel",
    definitions: [{
      type: 0,
      name: "void",
      styles: {
        type: 6,
        styles: {
          opacity: 0,
          transform: "scale(1, 0.8)"
        },
        offset: null
      }
    }, {
      type: 1,
      expr: "void => showing",
      animation: {
        type: 4,
        styles: {
          type: 6,
          styles: {
            opacity: 1,
            transform: "scale(1, 1)"
          },
          offset: null
        },
        timings: "120ms cubic-bezier(0, 0, 0.2, 1)"
      },
      options: null
    }, {
      type: 1,
      expr: "* => void",
      animation: {
        type: 4,
        styles: {
          type: 6,
          styles: {
            opacity: 0
          },
          offset: null
        },
        timings: "100ms linear"
      },
      options: null
    }],
    options: {}
  }
};
export {
  MAT_SELECT_CONFIG,
  MAT_SELECT_SCROLL_STRATEGY,
  MAT_SELECT_SCROLL_STRATEGY_PROVIDER,
  MAT_SELECT_SCROLL_STRATEGY_PROVIDER_FACTORY,
  MAT_SELECT_TRIGGER,
  MatError,
  MatFormField,
  MatHint,
  MatLabel,
  MatOptgroup,
  MatOption,
  MatPrefix,
  MatSelect,
  MatSelectChange,
  MatSelectModule,
  MatSelectTrigger,
  MatSuffix,
  matSelectAnimations
};
//# sourceMappingURL=@angular_material_select.js.map
