import"./index.es-e8cMnWWl.js";import{C as e,D as t,E as n,F as r,I as i,L as a,O as o,S as s,T as c,_ as l,a as u,b as d,d as f,i as p,k as m,n as h,o as ee,p as g,r as te,s as _,t as v,u as y,w as b,x,y as S,z as ne}from"./ConstantsUtil-DZoOpHL8.js";import{i as C,l as w,t as T}from"./lit-8oBG13LT.js";import{a as E,i as D,o as O}from"./wui-text-DMHxSD1O.js";import"./events-Bo2wVcL3.js";import{t as k}from"./SIWXUtil-wBjvo4sI.js";var A=a({message:``,open:!1,triggerRect:{width:0,height:0,top:0,left:0},variant:`shade`}),j=t({state:A,subscribe(e){return ne(A,()=>e(A))},subscribeKey(e,t){return i(A,e,t)},showTooltip({message:e,triggerRect:t,variant:n}){A.open=!0,A.message=e,A.triggerRect=t,A.variant=n},hide(){A.open=!1,A.message=``,A.triggerRect={width:0,height:0,top:0,left:0}}}),re={isUnsupportedChainView(){return x.state.view===`UnsupportedChain`||x.state.view===`SwitchNetwork`&&x.state.history.includes(`UnsupportedChain`)},async safeClose(){if(this.isUnsupportedChainView()){y.shake();return}if(await k.isSIWXCloseDisabled()){y.shake();return}y.close()}},ie=w`
  :host {
    display: block;
    border-radius: clamp(0px, var(--wui-border-radius-l), 44px);
    box-shadow: 0 0 0 1px var(--wui-color-gray-glass-005);
    background-color: var(--wui-color-modal-bg);
    overflow: hidden;
  }

  :host([data-embedded='true']) {
    box-shadow:
      0 0 0 1px var(--wui-color-gray-glass-005),
      0px 4px 12px 4px var(--w3m-card-embedded-shadow-color);
  }
`,ae=function(e,t,n,r){var i=arguments.length,a=i<3?t:r===null?r=Object.getOwnPropertyDescriptor(t,n):r,o;if(typeof Reflect==`object`&&typeof Reflect.decorate==`function`)a=Reflect.decorate(e,t,n,r);else for(var s=e.length-1;s>=0;s--)(o=e[s])&&(a=(i<3?o(a):i>3?o(t,n,a):o(t,n))||a);return i>3&&a&&Object.defineProperty(t,n,a),a},M=class extends T{render(){return C`<slot></slot>`}};M.styles=[_,ie],M=ae([h(`wui-card`)],M);var oe=w`
  :host {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--wui-spacing-s);
    border-radius: var(--wui-border-radius-s);
    border: 1px solid var(--wui-color-dark-glass-100);
    box-sizing: border-box;
    background-color: var(--wui-color-bg-325);
    box-shadow: 0px 0px 16px 0px rgba(0, 0, 0, 0.25);
  }

  wui-flex {
    width: 100%;
  }

  wui-text {
    word-break: break-word;
    flex: 1;
  }

  .close {
    cursor: pointer;
  }

  .icon-box {
    height: 40px;
    width: 40px;
    border-radius: var(--wui-border-radius-3xs);
    background-color: var(--local-icon-bg-value);
  }
`,N=function(e,t,n,r){var i=arguments.length,a=i<3?t:r===null?r=Object.getOwnPropertyDescriptor(t,n):r,o;if(typeof Reflect==`object`&&typeof Reflect.decorate==`function`)a=Reflect.decorate(e,t,n,r);else for(var s=e.length-1;s>=0;s--)(o=e[s])&&(a=(i<3?o(a):i>3?o(t,n,a):o(t,n))||a);return i>3&&a&&Object.defineProperty(t,n,a),a},P=class extends T{constructor(){super(...arguments),this.message=``,this.backgroundColor=`accent-100`,this.iconColor=`accent-100`,this.icon=`info`}render(){return this.style.cssText=`
      --local-icon-bg-value: var(--wui-color-${this.backgroundColor});
   `,C`
      <wui-flex flexDirection="row" justifyContent="space-between" alignItems="center">
        <wui-flex columnGap="xs" flexDirection="row" alignItems="center">
          <wui-flex
            flexDirection="row"
            alignItems="center"
            justifyContent="center"
            class="icon-box"
          >
            <wui-icon color=${this.iconColor} size="md" name=${this.icon}></wui-icon>
          </wui-flex>
          <wui-text variant="small-500" color="bg-350" data-testid="wui-alertbar-text"
            >${this.message}</wui-text
          >
        </wui-flex>
        <wui-icon
          class="close"
          color="bg-350"
          size="sm"
          name="close"
          @click=${this.onClose}
        ></wui-icon>
      </wui-flex>
    `}onClose(){b.close()}};P.styles=[_,oe],N([O()],P.prototype,`message`,void 0),N([O()],P.prototype,`backgroundColor`,void 0),N([O()],P.prototype,`iconColor`,void 0),N([O()],P.prototype,`icon`,void 0),P=N([h(`wui-alertbar`)],P);var se=w`
  :host {
    display: block;
    position: absolute;
    top: var(--wui-spacing-s);
    left: var(--wui-spacing-l);
    right: var(--wui-spacing-l);
    opacity: 0;
    pointer-events: none;
  }
`,F=function(e,t,n,r){var i=arguments.length,a=i<3?t:r===null?r=Object.getOwnPropertyDescriptor(t,n):r,o;if(typeof Reflect==`object`&&typeof Reflect.decorate==`function`)a=Reflect.decorate(e,t,n,r);else for(var s=e.length-1;s>=0;s--)(o=e[s])&&(a=(i<3?o(a):i>3?o(t,n,a):o(t,n))||a);return i>3&&a&&Object.defineProperty(t,n,a),a},ce={info:{backgroundColor:`fg-350`,iconColor:`fg-325`,icon:`info`},success:{backgroundColor:`success-glass-reown-020`,iconColor:`success-125`,icon:`checkmark`},warning:{backgroundColor:`warning-glass-reown-020`,iconColor:`warning-100`,icon:`warningCircle`},error:{backgroundColor:`error-glass-reown-020`,iconColor:`error-125`,icon:`exclamationTriangle`}},I=class extends T{constructor(){super(),this.unsubscribe=[],this.open=b.state.open,this.onOpen(!0),this.unsubscribe.push(b.subscribeKey(`open`,e=>{this.open=e,this.onOpen(!1)}))}disconnectedCallback(){this.unsubscribe.forEach(e=>e())}render(){let{message:e,variant:t}=b.state,n=ce[t];return C`
      <wui-alertbar
        message=${e}
        backgroundColor=${n?.backgroundColor}
        iconColor=${n?.iconColor}
        icon=${n?.icon}
      ></wui-alertbar>
    `}onOpen(e){this.open?(this.animate([{opacity:0,transform:`scale(0.85)`},{opacity:1,transform:`scale(1)`}],{duration:150,fill:`forwards`,easing:`ease`}),this.style.cssText=`pointer-events: auto`):e||(this.animate([{opacity:1,transform:`scale(1)`},{opacity:0,transform:`scale(0.85)`}],{duration:150,fill:`forwards`,easing:`ease`}),this.style.cssText=`pointer-events: none`)}};I.styles=se,F([E()],I.prototype,`open`,void 0),I=F([h(`w3m-alertbar`)],I);var le=w`
  button {
    border-radius: var(--local-border-radius);
    color: var(--wui-color-fg-100);
    padding: var(--local-padding);
  }

  @media (max-width: 700px) {
    button {
      padding: var(--wui-spacing-s);
    }
  }

  button > wui-icon {
    pointer-events: none;
  }

  button:disabled > wui-icon {
    color: var(--wui-color-bg-300) !important;
  }

  button:disabled {
    background-color: transparent;
  }
`,L=function(e,t,n,r){var i=arguments.length,a=i<3?t:r===null?r=Object.getOwnPropertyDescriptor(t,n):r,o;if(typeof Reflect==`object`&&typeof Reflect.decorate==`function`)a=Reflect.decorate(e,t,n,r);else for(var s=e.length-1;s>=0;s--)(o=e[s])&&(a=(i<3?o(a):i>3?o(t,n,a):o(t,n))||a);return i>3&&a&&Object.defineProperty(t,n,a),a},R=class extends T{constructor(){super(...arguments),this.size=`md`,this.disabled=!1,this.icon=`copy`,this.iconColor=`inherit`}render(){let e=this.size===`lg`?`--wui-border-radius-xs`:`--wui-border-radius-xxs`,t=this.size===`lg`?`--wui-spacing-1xs`:`--wui-spacing-2xs`;return this.style.cssText=`
    --local-border-radius: var(${e});
    --local-padding: var(${t});
`,C`
      <button ?disabled=${this.disabled}>
        <wui-icon color=${this.iconColor} size=${this.size} name=${this.icon}></wui-icon>
      </button>
    `}};R.styles=[_,u,p,le],L([O()],R.prototype,`size`,void 0),L([O({type:Boolean})],R.prototype,`disabled`,void 0),L([O()],R.prototype,`icon`,void 0),L([O()],R.prototype,`iconColor`,void 0),R=L([h(`wui-icon-link`)],R);var ue=w`
  button {
    display: block;
    display: flex;
    align-items: center;
    padding: var(--wui-spacing-xxs);
    gap: var(--wui-spacing-xxs);
    transition: all var(--wui-ease-out-power-1) var(--wui-duration-md);
    border-radius: var(--wui-border-radius-xxs);
  }

  wui-image {
    border-radius: 100%;
    width: var(--wui-spacing-xl);
    height: var(--wui-spacing-xl);
  }

  wui-icon-box {
    width: var(--wui-spacing-xl);
    height: var(--wui-spacing-xl);
  }

  button:hover {
    background-color: var(--wui-color-gray-glass-002);
  }

  button:active {
    background-color: var(--wui-color-gray-glass-005);
  }
`,de=function(e,t,n,r){var i=arguments.length,a=i<3?t:r===null?r=Object.getOwnPropertyDescriptor(t,n):r,o;if(typeof Reflect==`object`&&typeof Reflect.decorate==`function`)a=Reflect.decorate(e,t,n,r);else for(var s=e.length-1;s>=0;s--)(o=e[s])&&(a=(i<3?o(a):i>3?o(t,n,a):o(t,n))||a);return i>3&&a&&Object.defineProperty(t,n,a),a},z=class extends T{constructor(){super(...arguments),this.imageSrc=``}render(){return C`<button>
      ${this.imageTemplate()}
      <wui-icon size="xs" color="fg-200" name="chevronBottom"></wui-icon>
    </button>`}imageTemplate(){return this.imageSrc?C`<wui-image src=${this.imageSrc} alt="select visual"></wui-image>`:C`<wui-icon-box
      size="xxs"
      iconColor="fg-200"
      backgroundColor="fg-100"
      background="opaque"
      icon="networkPlaceholder"
    ></wui-icon-box>`}};z.styles=[_,u,p,ue],de([O()],z.prototype,`imageSrc`,void 0),z=de([h(`wui-select`)],z);var fe=w`
  :host {
    height: 64px;
  }

  wui-text {
    text-transform: capitalize;
  }

  wui-flex.w3m-header-title {
    transform: translateY(0);
    opacity: 1;
  }

  wui-flex.w3m-header-title[view-direction='prev'] {
    animation:
      slide-down-out 120ms forwards var(--wui-ease-out-power-2),
      slide-down-in 120ms forwards var(--wui-ease-out-power-2);
    animation-delay: 0ms, 200ms;
  }

  wui-flex.w3m-header-title[view-direction='next'] {
    animation:
      slide-up-out 120ms forwards var(--wui-ease-out-power-2),
      slide-up-in 120ms forwards var(--wui-ease-out-power-2);
    animation-delay: 0ms, 200ms;
  }

  wui-icon-link[data-hidden='true'] {
    opacity: 0 !important;
    pointer-events: none;
  }

  @keyframes slide-up-out {
    from {
      transform: translateY(0px);
      opacity: 1;
    }
    to {
      transform: translateY(3px);
      opacity: 0;
    }
  }

  @keyframes slide-up-in {
    from {
      transform: translateY(-3px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }

  @keyframes slide-down-out {
    from {
      transform: translateY(0px);
      opacity: 1;
    }
    to {
      transform: translateY(-3px);
      opacity: 0;
    }
  }

  @keyframes slide-down-in {
    from {
      transform: translateY(3px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }
`,B=function(e,t,n,r){var i=arguments.length,a=i<3?t:r===null?r=Object.getOwnPropertyDescriptor(t,n):r,o;if(typeof Reflect==`object`&&typeof Reflect.decorate==`function`)a=Reflect.decorate(e,t,n,r);else for(var s=e.length-1;s>=0;s--)(o=e[s])&&(a=(i<3?o(a):i>3?o(t,n,a):o(t,n))||a);return i>3&&a&&Object.defineProperty(t,n,a),a},pe=[`SmartSessionList`];function V(){let e=x.state.data?.connector?.name,t=x.state.data?.wallet?.name,n=x.state.data?.network?.name,r=t??e,i=S.getConnectors();return{Connect:`Connect ${i.length===1&&i[0]?.id===`w3m-email`?`Email`:``} Wallet`,Create:`Create Wallet`,ChooseAccountName:void 0,Account:void 0,AccountSettings:void 0,AllWallets:`All Wallets`,ApproveTransaction:`Approve Transaction`,BuyInProgress:`Buy`,ConnectingExternal:r??`Connect Wallet`,ConnectingWalletConnect:r??`WalletConnect`,ConnectingWalletConnectBasic:`WalletConnect`,ConnectingSiwe:`Sign In`,Convert:`Convert`,ConvertSelectToken:`Select token`,ConvertPreview:`Preview convert`,Downloads:r?`Get ${r}`:`Downloads`,EmailLogin:`Email Login`,EmailVerifyOtp:`Confirm Email`,EmailVerifyDevice:`Register Device`,GetWallet:`Get a wallet`,Networks:`Choose Network`,OnRampProviders:`Choose Provider`,OnRampActivity:`Activity`,OnRampTokenSelect:`Select Token`,OnRampFiatSelect:`Select Currency`,Pay:`How you pay`,Profile:void 0,SwitchNetwork:n??`Switch Network`,SwitchAddress:`Switch Address`,Transactions:`Activity`,UnsupportedChain:`Switch Network`,UpgradeEmailWallet:`Upgrade your Wallet`,UpdateEmailWallet:`Edit Email`,UpdateEmailPrimaryOtp:`Confirm Current Email`,UpdateEmailSecondaryOtp:`Confirm New Email`,WhatIsABuy:`What is Buy?`,RegisterAccountName:`Choose name`,RegisterAccountNameSuccess:``,WalletReceive:`Receive`,WalletCompatibleNetworks:`Compatible Networks`,Swap:`Swap`,SwapSelectToken:`Select token`,SwapPreview:`Preview swap`,WalletSend:`Send`,WalletSendPreview:`Review send`,WalletSendSelectToken:`Select Token`,WhatIsANetwork:`What is a network?`,WhatIsAWallet:`What is a wallet?`,ConnectWallets:`Connect wallet`,ConnectSocials:`All socials`,ConnectingSocial:f.state.socialProvider?f.state.socialProvider:`Connect Social`,ConnectingMultiChain:`Select chain`,ConnectingFarcaster:`Farcaster`,SwitchActiveChain:`Switch chain`,SmartSessionCreated:void 0,SmartSessionList:`Smart Sessions`,SIWXSignMessage:`Sign In`,PayLoading:`Payment in progress`}}var H=class extends T{constructor(){super(),this.unsubscribe=[],this.heading=V()[x.state.view],this.network=g.state.activeCaipNetwork,this.networkImage=c.getNetworkImage(this.network),this.showBack=!1,this.prevHistoryLength=1,this.view=x.state.view,this.viewDirection=``,this.headerText=V()[x.state.view],this.unsubscribe.push(n.subscribeNetworkImages(()=>{this.networkImage=c.getNetworkImage(this.network)}),x.subscribeKey(`view`,e=>{setTimeout(()=>{this.view=e,this.headerText=V()[e]},v.ANIMATION_DURATIONS.HeaderText),this.onViewChange(),this.onHistoryChange()}),g.subscribeKey(`activeCaipNetwork`,e=>{this.network=e,this.networkImage=c.getNetworkImage(this.network)}))}disconnectCallback(){this.unsubscribe.forEach(e=>e())}render(){return C`
      <wui-flex .padding=${this.getPadding()} justifyContent="space-between" alignItems="center">
        ${this.leftHeaderTemplate()} ${this.titleTemplate()} ${this.rightHeaderTemplate()}
      </wui-flex>
    `}onWalletHelp(){e.sendEvent({type:`track`,event:`CLICK_WALLET_HELP`}),x.push(`WhatIsAWallet`)}async onClose(){await re.safeClose()}rightHeaderTemplate(){let e=o?.state?.features?.smartSessions;return x.state.view!==`Account`||!e?this.closeButtonTemplate():C`<wui-flex>
      <wui-icon-link
        icon="clock"
        @click=${()=>x.push(`SmartSessionList`)}
        data-testid="w3m-header-smart-sessions"
      ></wui-icon-link>
      ${this.closeButtonTemplate()}
    </wui-flex> `}closeButtonTemplate(){return C`
      <wui-icon-link
        icon="close"
        @click=${this.onClose.bind(this)}
        data-testid="w3m-header-close"
      ></wui-icon-link>
    `}titleTemplate(){let e=pe.includes(this.view);return C`
      <wui-flex
        view-direction="${this.viewDirection}"
        class="w3m-header-title"
        alignItems="center"
        gap="xs"
      >
        <wui-text variant="paragraph-700" color="fg-100" data-testid="w3m-header-text"
          >${this.headerText}</wui-text
        >
        ${e?C`<wui-tag variant="main">Beta</wui-tag>`:null}
      </wui-flex>
    `}leftHeaderTemplate(){let{view:e}=x.state,t=e===`Connect`,n=o.state.enableEmbedded,r=e===`ApproveTransaction`,i=e===`ConnectingSiwe`,a=e===`Account`,s=o.state.enableNetworkSwitch,c=r||i||t&&n;return a&&s?C`<wui-select
        id="dynamic"
        data-testid="w3m-account-select-network"
        active-network=${D(this.network?.name)}
        @click=${this.onNetworks.bind(this)}
        imageSrc=${D(this.networkImage)}
      ></wui-select>`:this.showBack&&!c?C`<wui-icon-link
        data-testid="header-back"
        id="dynamic"
        icon="chevronLeft"
        @click=${this.onGoBack.bind(this)}
      ></wui-icon-link>`:C`<wui-icon-link
      data-hidden=${!t}
      id="dynamic"
      icon="helpCircle"
      @click=${this.onWalletHelp.bind(this)}
    ></wui-icon-link>`}onNetworks(){this.isAllowedNetworkSwitch()&&(e.sendEvent({type:`track`,event:`CLICK_NETWORKS`}),x.push(`Networks`))}isAllowedNetworkSwitch(){let e=g.getAllRequestedCaipNetworks(),t=e?e.length>1:!1,n=e?.find(({id:e})=>e===this.network?.id);return t||!n}getPadding(){return this.heading?[`l`,`2l`,`l`,`2l`]:[`0`,`2l`,`0`,`2l`]}onViewChange(){let{history:e}=x.state,t=v.VIEW_DIRECTION.Next;e.length<this.prevHistoryLength&&(t=v.VIEW_DIRECTION.Prev),this.prevHistoryLength=e.length,this.viewDirection=t}async onHistoryChange(){let{history:e}=x.state,t=this.shadowRoot?.querySelector(`#dynamic`);e.length>1&&!this.showBack&&t?(await t.animate([{opacity:1},{opacity:0}],{duration:200,fill:`forwards`,easing:`ease`}).finished,this.showBack=!0,t.animate([{opacity:0},{opacity:1}],{duration:200,fill:`forwards`,easing:`ease`})):e.length<=1&&this.showBack&&t&&(await t.animate([{opacity:1},{opacity:0}],{duration:200,fill:`forwards`,easing:`ease`}).finished,this.showBack=!1,t.animate([{opacity:0},{opacity:1}],{duration:200,fill:`forwards`,easing:`ease`}))}onGoBack(){x.goBack()}};H.styles=fe,B([E()],H.prototype,`heading`,void 0),B([E()],H.prototype,`network`,void 0),B([E()],H.prototype,`networkImage`,void 0),B([E()],H.prototype,`showBack`,void 0),B([E()],H.prototype,`prevHistoryLength`,void 0),B([E()],H.prototype,`view`,void 0),B([E()],H.prototype,`viewDirection`,void 0),B([E()],H.prototype,`headerText`,void 0),H=B([h(`w3m-header`)],H);var me=w`
  :host {
    display: flex;
    column-gap: var(--wui-spacing-s);
    align-items: center;
    padding: var(--wui-spacing-xs) var(--wui-spacing-m) var(--wui-spacing-xs) var(--wui-spacing-xs);
    border-radius: var(--wui-border-radius-s);
    border: 1px solid var(--wui-color-gray-glass-005);
    box-sizing: border-box;
    background-color: var(--wui-color-bg-175);
    box-shadow:
      0px 14px 64px -4px rgba(0, 0, 0, 0.15),
      0px 8px 22px -6px rgba(0, 0, 0, 0.15);

    max-width: 300px;
  }

  :host wui-loading-spinner {
    margin-left: var(--wui-spacing-3xs);
  }
`,U=function(e,t,n,r){var i=arguments.length,a=i<3?t:r===null?r=Object.getOwnPropertyDescriptor(t,n):r,o;if(typeof Reflect==`object`&&typeof Reflect.decorate==`function`)a=Reflect.decorate(e,t,n,r);else for(var s=e.length-1;s>=0;s--)(o=e[s])&&(a=(i<3?o(a):i>3?o(t,n,a):o(t,n))||a);return i>3&&a&&Object.defineProperty(t,n,a),a},W=class extends T{constructor(){super(...arguments),this.backgroundColor=`accent-100`,this.iconColor=`accent-100`,this.icon=`checkmark`,this.message=``,this.loading=!1,this.iconType=`default`}render(){return C`
      ${this.templateIcon()}
      <wui-text variant="paragraph-500" color="fg-100" data-testid="wui-snackbar-message"
        >${this.message}</wui-text
      >
    `}templateIcon(){return this.loading?C`<wui-loading-spinner size="md" color="accent-100"></wui-loading-spinner>`:this.iconType===`default`?C`<wui-icon size="xl" color=${this.iconColor} name=${this.icon}></wui-icon>`:C`<wui-icon-box
      size="sm"
      iconSize="xs"
      iconColor=${this.iconColor}
      backgroundColor=${this.backgroundColor}
      icon=${this.icon}
      background="opaque"
    ></wui-icon-box>`}};W.styles=[_,me],U([O()],W.prototype,`backgroundColor`,void 0),U([O()],W.prototype,`iconColor`,void 0),U([O()],W.prototype,`icon`,void 0),U([O()],W.prototype,`message`,void 0),U([O()],W.prototype,`loading`,void 0),U([O()],W.prototype,`iconType`,void 0),W=U([h(`wui-snackbar`)],W);var he=w`
  :host {
    display: block;
    position: absolute;
    opacity: 0;
    pointer-events: none;
    top: 11px;
    left: 50%;
    width: max-content;
  }
`,ge=function(e,t,n,r){var i=arguments.length,a=i<3?t:r===null?r=Object.getOwnPropertyDescriptor(t,n):r,o;if(typeof Reflect==`object`&&typeof Reflect.decorate==`function`)a=Reflect.decorate(e,t,n,r);else for(var s=e.length-1;s>=0;s--)(o=e[s])&&(a=(i<3?o(a):i>3?o(t,n,a):o(t,n))||a);return i>3&&a&&Object.defineProperty(t,n,a),a},_e={loading:void 0,success:{backgroundColor:`success-100`,iconColor:`success-100`,icon:`checkmark`},error:{backgroundColor:`error-100`,iconColor:`error-100`,icon:`close`}},G=class extends T{constructor(){super(),this.unsubscribe=[],this.timeout=void 0,this.open=l.state.open,this.unsubscribe.push(l.subscribeKey(`open`,e=>{this.open=e,this.onOpen()}))}disconnectedCallback(){clearTimeout(this.timeout),this.unsubscribe.forEach(e=>e())}render(){let{message:e,variant:t,svg:n}=l.state,r=_e[t],{icon:i,iconColor:a}=n??r??{};return C`
      <wui-snackbar
        message=${e}
        backgroundColor=${r?.backgroundColor}
        iconColor=${a}
        icon=${i}
        .loading=${t===`loading`}
      ></wui-snackbar>
    `}onOpen(){clearTimeout(this.timeout),this.open?(this.animate([{opacity:0,transform:`translateX(-50%) scale(0.85)`},{opacity:1,transform:`translateX(-50%) scale(1)`}],{duration:150,fill:`forwards`,easing:`ease`}),this.timeout&&clearTimeout(this.timeout),l.state.autoClose&&(this.timeout=setTimeout(()=>l.hide(),2500))):this.animate([{opacity:1,transform:`translateX(-50%) scale(1)`},{opacity:0,transform:`translateX(-50%) scale(0.85)`}],{duration:150,fill:`forwards`,easing:`ease`})}};G.styles=he,ge([E()],G.prototype,`open`,void 0),G=ge([h(`w3m-snackbar`)],G);var ve=w`
  :host {
    pointer-events: none;
  }

  :host > wui-flex {
    display: var(--w3m-tooltip-display);
    opacity: var(--w3m-tooltip-opacity);
    padding: 9px var(--wui-spacing-s) 10px var(--wui-spacing-s);
    border-radius: var(--wui-border-radius-xxs);
    color: var(--wui-color-bg-100);
    position: fixed;
    top: var(--w3m-tooltip-top);
    left: var(--w3m-tooltip-left);
    transform: translate(calc(-50% + var(--w3m-tooltip-parent-width)), calc(-100% - 8px));
    max-width: calc(var(--w3m-modal-width) - var(--wui-spacing-xl));
    transition: opacity 0.2s var(--wui-ease-out-power-2);
    will-change: opacity;
  }

  :host([data-variant='shade']) > wui-flex {
    background-color: var(--wui-color-bg-150);
    border: 1px solid var(--wui-color-gray-glass-005);
  }

  :host([data-variant='shade']) > wui-flex > wui-text {
    color: var(--wui-color-fg-150);
  }

  :host([data-variant='fill']) > wui-flex {
    background-color: var(--wui-color-fg-100);
    border: none;
  }

  wui-icon {
    position: absolute;
    width: 12px !important;
    height: 4px !important;
    color: var(--wui-color-bg-150);
  }

  wui-icon[data-placement='top'] {
    bottom: 0px;
    left: 50%;
    transform: translate(-50%, 95%);
  }

  wui-icon[data-placement='bottom'] {
    top: 0;
    left: 50%;
    transform: translate(-50%, -95%) rotate(180deg);
  }

  wui-icon[data-placement='right'] {
    top: 50%;
    left: 0;
    transform: translate(-65%, -50%) rotate(90deg);
  }

  wui-icon[data-placement='left'] {
    top: 50%;
    right: 0%;
    transform: translate(65%, -50%) rotate(270deg);
  }
`,K=function(e,t,n,r){var i=arguments.length,a=i<3?t:r===null?r=Object.getOwnPropertyDescriptor(t,n):r,o;if(typeof Reflect==`object`&&typeof Reflect.decorate==`function`)a=Reflect.decorate(e,t,n,r);else for(var s=e.length-1;s>=0;s--)(o=e[s])&&(a=(i<3?o(a):i>3?o(t,n,a):o(t,n))||a);return i>3&&a&&Object.defineProperty(t,n,a),a},q=class extends T{constructor(){super(),this.unsubscribe=[],this.open=j.state.open,this.message=j.state.message,this.triggerRect=j.state.triggerRect,this.variant=j.state.variant,this.unsubscribe.push(j.subscribe(e=>{this.open=e.open,this.message=e.message,this.triggerRect=e.triggerRect,this.variant=e.variant}))}disconnectedCallback(){this.unsubscribe.forEach(e=>e())}render(){this.dataset.variant=this.variant;let e=this.triggerRect.top,t=this.triggerRect.left;return this.style.cssText=`
    --w3m-tooltip-top: ${e}px;
    --w3m-tooltip-left: ${t}px;
    --w3m-tooltip-parent-width: ${this.triggerRect.width/2}px;
    --w3m-tooltip-display: ${this.open?`flex`:`none`};
    --w3m-tooltip-opacity: ${this.open?1:0};
    `,C`<wui-flex>
      <wui-icon data-placement="top" color="fg-100" size="inherit" name="cursor"></wui-icon>
      <wui-text color="inherit" variant="small-500">${this.message}</wui-text>
    </wui-flex>`}};q.styles=[ve],K([E()],q.prototype,`open`,void 0),K([E()],q.prototype,`message`,void 0),K([E()],q.prototype,`triggerRect`,void 0),K([E()],q.prototype,`variant`,void 0),q=K([h(`w3m-tooltip`),h(`w3m-tooltip`)],q);var ye=w`
  :host {
    --prev-height: 0px;
    --new-height: 0px;
    display: block;
  }

  div.w3m-router-container {
    transform: translateY(0);
    opacity: 1;
  }

  div.w3m-router-container[view-direction='prev'] {
    animation:
      slide-left-out 150ms forwards ease,
      slide-left-in 150ms forwards ease;
    animation-delay: 0ms, 200ms;
  }

  div.w3m-router-container[view-direction='next'] {
    animation:
      slide-right-out 150ms forwards ease,
      slide-right-in 150ms forwards ease;
    animation-delay: 0ms, 200ms;
  }

  @keyframes slide-left-out {
    from {
      transform: translateX(0px);
      opacity: 1;
    }
    to {
      transform: translateX(10px);
      opacity: 0;
    }
  }

  @keyframes slide-left-in {
    from {
      transform: translateX(-10px);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  @keyframes slide-right-out {
    from {
      transform: translateX(0px);
      opacity: 1;
    }
    to {
      transform: translateX(-10px);
      opacity: 0;
    }
  }

  @keyframes slide-right-in {
    from {
      transform: translateX(10px);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
`,J=function(e,t,n,r){var i=arguments.length,a=i<3?t:r===null?r=Object.getOwnPropertyDescriptor(t,n):r,o;if(typeof Reflect==`object`&&typeof Reflect.decorate==`function`)a=Reflect.decorate(e,t,n,r);else for(var s=e.length-1;s>=0;s--)(o=e[s])&&(a=(i<3?o(a):i>3?o(t,n,a):o(t,n))||a);return i>3&&a&&Object.defineProperty(t,n,a),a},Y=class extends T{constructor(){super(),this.resizeObserver=void 0,this.prevHeight=`0px`,this.prevHistoryLength=1,this.unsubscribe=[],this.view=x.state.view,this.viewDirection=``,this.unsubscribe.push(x.subscribeKey(`view`,e=>this.onViewChange(e)))}firstUpdated(){this.resizeObserver=new ResizeObserver(([e])=>{let t=`${e?.contentRect.height}px`;this.prevHeight!==`0px`&&(this.style.setProperty(`--prev-height`,this.prevHeight),this.style.setProperty(`--new-height`,t),this.style.animation=`w3m-view-height 150ms forwards ease`,this.style.height=`auto`),setTimeout(()=>{this.prevHeight=t,this.style.animation=`unset`},v.ANIMATION_DURATIONS.ModalHeight)}),this.resizeObserver?.observe(this.getWrapper())}disconnectedCallback(){this.resizeObserver?.unobserve(this.getWrapper()),this.unsubscribe.forEach(e=>e())}render(){return C`<div class="w3m-router-container" view-direction="${this.viewDirection}">
      ${this.viewTemplate()}
    </div>`}viewTemplate(){switch(this.view){case`AccountSettings`:return C`<w3m-account-settings-view></w3m-account-settings-view>`;case`Account`:return C`<w3m-account-view></w3m-account-view>`;case`AllWallets`:return C`<w3m-all-wallets-view></w3m-all-wallets-view>`;case`ApproveTransaction`:return C`<w3m-approve-transaction-view></w3m-approve-transaction-view>`;case`BuyInProgress`:return C`<w3m-buy-in-progress-view></w3m-buy-in-progress-view>`;case`ChooseAccountName`:return C`<w3m-choose-account-name-view></w3m-choose-account-name-view>`;case`Connect`:return C`<w3m-connect-view></w3m-connect-view>`;case`Create`:return C`<w3m-connect-view walletGuide="explore"></w3m-connect-view>`;case`ConnectingWalletConnect`:return C`<w3m-connecting-wc-view></w3m-connecting-wc-view>`;case`ConnectingWalletConnectBasic`:return C`<w3m-connecting-wc-basic-view></w3m-connecting-wc-basic-view>`;case`ConnectingExternal`:return C`<w3m-connecting-external-view></w3m-connecting-external-view>`;case`ConnectingSiwe`:return C`<w3m-connecting-siwe-view></w3m-connecting-siwe-view>`;case`ConnectWallets`:return C`<w3m-connect-wallets-view></w3m-connect-wallets-view>`;case`ConnectSocials`:return C`<w3m-connect-socials-view></w3m-connect-socials-view>`;case`ConnectingSocial`:return C`<w3m-connecting-social-view></w3m-connecting-social-view>`;case`Downloads`:return C`<w3m-downloads-view></w3m-downloads-view>`;case`EmailLogin`:return C`<w3m-email-login-view></w3m-email-login-view>`;case`EmailVerifyOtp`:return C`<w3m-email-verify-otp-view></w3m-email-verify-otp-view>`;case`EmailVerifyDevice`:return C`<w3m-email-verify-device-view></w3m-email-verify-device-view>`;case`GetWallet`:return C`<w3m-get-wallet-view></w3m-get-wallet-view>`;case`Networks`:return C`<w3m-networks-view></w3m-networks-view>`;case`SwitchNetwork`:return C`<w3m-network-switch-view></w3m-network-switch-view>`;case`Profile`:return C`<w3m-profile-view></w3m-profile-view>`;case`SwitchAddress`:return C`<w3m-switch-address-view></w3m-switch-address-view>`;case`Transactions`:return C`<w3m-transactions-view></w3m-transactions-view>`;case`OnRampProviders`:return C`<w3m-onramp-providers-view></w3m-onramp-providers-view>`;case`OnRampActivity`:return C`<w3m-onramp-activity-view></w3m-onramp-activity-view>`;case`OnRampTokenSelect`:return C`<w3m-onramp-token-select-view></w3m-onramp-token-select-view>`;case`OnRampFiatSelect`:return C`<w3m-onramp-fiat-select-view></w3m-onramp-fiat-select-view>`;case`UpgradeEmailWallet`:return C`<w3m-upgrade-wallet-view></w3m-upgrade-wallet-view>`;case`UpdateEmailWallet`:return C`<w3m-update-email-wallet-view></w3m-update-email-wallet-view>`;case`UpdateEmailPrimaryOtp`:return C`<w3m-update-email-primary-otp-view></w3m-update-email-primary-otp-view>`;case`UpdateEmailSecondaryOtp`:return C`<w3m-update-email-secondary-otp-view></w3m-update-email-secondary-otp-view>`;case`UnsupportedChain`:return C`<w3m-unsupported-chain-view></w3m-unsupported-chain-view>`;case`Swap`:return C`<w3m-swap-view></w3m-swap-view>`;case`SwapSelectToken`:return C`<w3m-swap-select-token-view></w3m-swap-select-token-view>`;case`SwapPreview`:return C`<w3m-swap-preview-view></w3m-swap-preview-view>`;case`WalletSend`:return C`<w3m-wallet-send-view></w3m-wallet-send-view>`;case`WalletSendSelectToken`:return C`<w3m-wallet-send-select-token-view></w3m-wallet-send-select-token-view>`;case`WalletSendPreview`:return C`<w3m-wallet-send-preview-view></w3m-wallet-send-preview-view>`;case`WhatIsABuy`:return C`<w3m-what-is-a-buy-view></w3m-what-is-a-buy-view>`;case`WalletReceive`:return C`<w3m-wallet-receive-view></w3m-wallet-receive-view>`;case`WalletCompatibleNetworks`:return C`<w3m-wallet-compatible-networks-view></w3m-wallet-compatible-networks-view>`;case`WhatIsAWallet`:return C`<w3m-what-is-a-wallet-view></w3m-what-is-a-wallet-view>`;case`ConnectingMultiChain`:return C`<w3m-connecting-multi-chain-view></w3m-connecting-multi-chain-view>`;case`WhatIsANetwork`:return C`<w3m-what-is-a-network-view></w3m-what-is-a-network-view>`;case`ConnectingFarcaster`:return C`<w3m-connecting-farcaster-view></w3m-connecting-farcaster-view>`;case`SwitchActiveChain`:return C`<w3m-switch-active-chain-view></w3m-switch-active-chain-view>`;case`RegisterAccountName`:return C`<w3m-register-account-name-view></w3m-register-account-name-view>`;case`RegisterAccountNameSuccess`:return C`<w3m-register-account-name-success-view></w3m-register-account-name-success-view>`;case`SmartSessionCreated`:return C`<w3m-smart-session-created-view></w3m-smart-session-created-view>`;case`SmartSessionList`:return C`<w3m-smart-session-list-view></w3m-smart-session-list-view>`;case`SIWXSignMessage`:return C`<w3m-siwx-sign-message-view></w3m-siwx-sign-message-view>`;case`Pay`:return C`<w3m-pay-view></w3m-pay-view>`;case`PayLoading`:return C`<w3m-pay-loading-view></w3m-pay-loading-view>`;default:return C`<w3m-connect-view></w3m-connect-view>`}}onViewChange(e){j.hide();let t=v.VIEW_DIRECTION.Next,{history:n}=x.state;n.length<this.prevHistoryLength&&(t=v.VIEW_DIRECTION.Prev),this.prevHistoryLength=n.length,this.viewDirection=t,setTimeout(()=>{this.view=e},v.ANIMATION_DURATIONS.ViewTransition)}getWrapper(){return this.shadowRoot?.querySelector(`div`)}};Y.styles=ye,J([E()],Y.prototype,`view`,void 0),J([E()],Y.prototype,`viewDirection`,void 0),Y=J([h(`w3m-router`)],Y);var be=w`
  :host {
    z-index: var(--w3m-z-index);
    display: block;
    backface-visibility: hidden;
    will-change: opacity;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    pointer-events: none;
    opacity: 0;
    background-color: var(--wui-cover);
    transition: opacity 0.2s var(--wui-ease-out-power-2);
    will-change: opacity;
  }

  :host(.open) {
    opacity: 1;
  }

  :host(.appkit-modal) {
    position: relative;
    pointer-events: unset;
    background: none;
    width: 100%;
    opacity: 1;
  }

  wui-card {
    max-width: var(--w3m-modal-width);
    width: 100%;
    position: relative;
    animation: zoom-in 0.2s var(--wui-ease-out-power-2);
    animation-fill-mode: backwards;
    outline: none;
    transition:
      border-radius var(--wui-duration-lg) var(--wui-ease-out-power-1),
      background-color var(--wui-duration-lg) var(--wui-ease-out-power-1);
    will-change: border-radius, background-color;
  }

  :host(.appkit-modal) wui-card {
    max-width: 400px;
  }

  wui-card[shake='true'] {
    animation:
      zoom-in 0.2s var(--wui-ease-out-power-2),
      w3m-shake 0.5s var(--wui-ease-out-power-2);
  }

  wui-flex {
    overflow-x: hidden;
    overflow-y: auto;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
  }

  @media (max-height: 700px) and (min-width: 431px) {
    wui-flex {
      align-items: flex-start;
    }

    wui-card {
      margin: var(--wui-spacing-xxl) 0px;
    }
  }

  @media (max-width: 430px) {
    wui-flex {
      align-items: flex-end;
    }

    wui-card {
      max-width: 100%;
      border-bottom-left-radius: var(--local-border-bottom-mobile-radius);
      border-bottom-right-radius: var(--local-border-bottom-mobile-radius);
      border-bottom: none;
      animation: slide-in 0.2s var(--wui-ease-out-power-2);
    }

    wui-card[shake='true'] {
      animation:
        slide-in 0.2s var(--wui-ease-out-power-2),
        w3m-shake 0.5s var(--wui-ease-out-power-2);
    }
  }

  @keyframes zoom-in {
    0% {
      transform: scale(0.95) translateY(0);
    }
    100% {
      transform: scale(1) translateY(0);
    }
  }

  @keyframes slide-in {
    0% {
      transform: scale(1) translateY(50px);
    }
    100% {
      transform: scale(1) translateY(0);
    }
  }

  @keyframes w3m-shake {
    0% {
      transform: scale(1) rotate(0deg);
    }
    20% {
      transform: scale(1) rotate(-1deg);
    }
    40% {
      transform: scale(1) rotate(1.5deg);
    }
    60% {
      transform: scale(1) rotate(-1.5deg);
    }
    80% {
      transform: scale(1) rotate(1deg);
    }
    100% {
      transform: scale(1) rotate(0deg);
    }
  }

  @keyframes w3m-view-height {
    from {
      height: var(--prev-height);
    }
    to {
      height: var(--new-height);
    }
  }
`,X=function(e,t,n,r){var i=arguments.length,a=i<3?t:r===null?r=Object.getOwnPropertyDescriptor(t,n):r,o;if(typeof Reflect==`object`&&typeof Reflect.decorate==`function`)a=Reflect.decorate(e,t,n,r);else for(var s=e.length-1;s>=0;s--)(o=e[s])&&(a=(i<3?o(a):i>3?o(t,n,a):o(t,n))||a);return i>3&&a&&Object.defineProperty(t,n,a),a},xe=`scroll-lock`,Z=class extends T{constructor(){super(),this.unsubscribe=[],this.abortController=void 0,this.hasPrefetched=!1,this.enableEmbedded=o.state.enableEmbedded,this.open=y.state.open,this.caipAddress=g.state.activeCaipAddress,this.caipNetwork=g.state.activeCaipNetwork,this.shake=y.state.shake,this.filterByNamespace=S.state.filterByNamespace,this.initializeTheming(),s.prefetchAnalyticsConfig(),this.unsubscribe.push(y.subscribeKey(`open`,e=>e?this.onOpen():this.onClose()),y.subscribeKey(`shake`,e=>this.shake=e),g.subscribeKey(`activeCaipNetwork`,e=>this.onNewNetwork(e)),g.subscribeKey(`activeCaipAddress`,e=>this.onNewAddress(e)),o.subscribeKey(`enableEmbedded`,e=>this.enableEmbedded=e),S.subscribeKey(`filterByNamespace`,e=>{this.filterByNamespace!==e&&!g.getAccountData(e)?.caipAddress&&(s.fetchRecommendedWallets(),this.filterByNamespace=e)}))}firstUpdated(){if(this.caipAddress){if(this.enableEmbedded){y.close(),this.prefetch();return}this.onNewAddress(this.caipAddress)}this.open&&this.onOpen(),this.enableEmbedded&&this.prefetch()}disconnectedCallback(){this.unsubscribe.forEach(e=>e()),this.onRemoveKeyboardListener()}render(){return this.style.cssText=`
      --local-border-bottom-mobile-radius: ${this.enableEmbedded?`clamp(0px, var(--wui-border-radius-l), 44px)`:`0px`};
    `,this.enableEmbedded?C`${this.contentTemplate()}
        <w3m-tooltip></w3m-tooltip> `:this.open?C`
          <wui-flex @click=${this.onOverlayClick.bind(this)} data-testid="w3m-modal-overlay">
            ${this.contentTemplate()}
          </wui-flex>
          <w3m-tooltip></w3m-tooltip>
        `:null}contentTemplate(){return C` <wui-card
      shake="${this.shake}"
      data-embedded="${D(this.enableEmbedded)}"
      role="alertdialog"
      aria-modal="true"
      tabindex="0"
      data-testid="w3m-modal-card"
    >
      <w3m-header></w3m-header>
      <w3m-router></w3m-router>
      <w3m-snackbar></w3m-snackbar>
      <w3m-alertbar></w3m-alertbar>
    </wui-card>`}async onOverlayClick(e){e.target===e.currentTarget&&await this.handleClose()}async handleClose(){await re.safeClose()}initializeTheming(){let{themeVariables:e,themeMode:t}=d.state;ee(e,te.getColorTheme(t))}onClose(){this.open=!1,this.classList.remove(`open`),this.onScrollUnlock(),l.hide(),this.onRemoveKeyboardListener()}onOpen(){this.open=!0,this.classList.add(`open`),this.onScrollLock(),this.onAddKeyboardListener()}onScrollLock(){let e=document.createElement(`style`);e.dataset.w3m=xe,e.textContent=`
      body {
        touch-action: none;
        overflow: hidden;
        overscroll-behavior: contain;
      }
      w3m-modal {
        pointer-events: auto;
      }
    `,document.head.appendChild(e)}onScrollUnlock(){let e=document.head.querySelector(`style[data-w3m="${xe}"]`);e&&e.remove()}onAddKeyboardListener(){this.abortController=new AbortController;let e=this.shadowRoot?.querySelector(`wui-card`);e?.focus(),window.addEventListener(`keydown`,t=>{if(t.key===`Escape`)this.handleClose();else if(t.key===`Tab`){let{tagName:n}=t.target;n&&!n.includes(`W3M-`)&&!n.includes(`WUI-`)&&e?.focus()}},this.abortController)}onRemoveKeyboardListener(){this.abortController?.abort(),this.abortController=void 0}async onNewAddress(e){let t=g.state.isSwitchingNamespace,n=m.getPlainAddress(e);!n&&!t?y.close():t&&n&&x.goBack(),await k.initializeIfEnabled(),this.caipAddress=e,g.setIsSwitchingNamespace(!1)}onNewNetwork(e){let t=this.caipNetwork,n=t?.caipNetworkId?.toString(),i=t?.chainNamespace,a=e?.caipNetworkId?.toString(),o=e?.chainNamespace,s=n!==a,c=s&&i===o,l=t?.name===r.UNSUPPORTED_NETWORK_NAME,u=x.state.view===`ConnectingExternal`,d=!g.getAccountData(e?.chainNamespace)?.caipAddress,f=x.state.view===`UnsupportedChain`,p=y.state.open,m=!1;p&&!u&&(d?s&&(m=!0):(f||c&&!l)&&(m=!0)),m&&x.state.view!==`SIWXSignMessage`&&x.goBack(),this.caipNetwork=e}prefetch(){this.hasPrefetched||=(s.prefetch(),s.fetchWalletsByPage({page:1}),!0)}};Z.styles=be,X([O({type:Boolean})],Z.prototype,`enableEmbedded`,void 0),X([E()],Z.prototype,`open`,void 0),X([E()],Z.prototype,`caipAddress`,void 0),X([E()],Z.prototype,`caipNetwork`,void 0),X([E()],Z.prototype,`shake`,void 0),X([E()],Z.prototype,`filterByNamespace`,void 0);var Q=class extends Z{};Q=X([h(`w3m-modal`)],Q);var $=class extends Z{};$=X([h(`appkit-modal`)],$);export{$ as AppKitModal,Q as W3mModal,Z as W3mModalBase};