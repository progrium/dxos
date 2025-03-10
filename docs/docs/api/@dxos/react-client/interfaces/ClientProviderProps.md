# Interface `ClientProviderProps`
> Declared in [`packages/sdk/react-client/src/client/ClientContext.tsx`]()


## Properties
### [children](https://github.com/dxos/dxos/blob/main/packages/sdk/react-client/src/client/ClientContext.tsx#L51)
Type: <code>ReactNode</code>



### [client](https://github.com/dxos/dxos/blob/main/packages/sdk/react-client/src/client/ClientContext.tsx#L72)
Type: <code>[Client](/api/@dxos/react-client/classes/Client) | Provider&lt;Promise&lt;[Client](/api/@dxos/react-client/classes/Client)&gt;&gt;</code>

Client object or async provider to enable to caller to do custom initialization.

Most apps won't need this.

### [config](https://github.com/dxos/dxos/blob/main/packages/sdk/react-client/src/client/ClientContext.tsx#L56)
Type: <code>[Config](/api/@dxos/react-client/classes/Config) | Provider&lt;Promise&lt;[Config](/api/@dxos/react-client/classes/Config)&gt;&gt;</code>

Config object or async provider.

### [fallback](https://github.com/dxos/dxos/blob/main/packages/sdk/react-client/src/client/ClientContext.tsx#L77)
Type: <code>FunctionComponent&lt;Partial&lt;[ClientContextProps](/api/@dxos/react-client/types/ClientContextProps)&gt;&gt;</code>

ReactNode to display until the client is available.

### [onInitialized](https://github.com/dxos/dxos/blob/main/packages/sdk/react-client/src/client/ClientContext.tsx#L89)
Type: <code>function</code>



### [registerSignalFactory](https://github.com/dxos/dxos/blob/main/packages/sdk/react-client/src/client/ClientContext.tsx#L82)
Type: <code>boolean</code>

Set to false to stop default signal factory from being registered.

### [services](https://github.com/dxos/dxos/blob/main/packages/sdk/react-client/src/client/ClientContext.tsx#L63)
Type: <code>function</code>



    