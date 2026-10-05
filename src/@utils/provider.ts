import {
  ArweaveFileObject,
  ComputeAlgorithm,
  ComputeEnvironment,
  ComputeOutput,
  FileInfo,
  IpfsFileObject,
  LoggerInstance,
  ProviderInstance,
  UrlFileObject,
  UserCustomParameters,
  getErrorMessage,
  S3FileObject,
  FtpFileObject,
  ProviderComputeInitializeResults,
  ProviderFees,
  ZERO_ADDRESS
} from '@oceanprotocol/lib'
import type { dockerRegistryAuth as DockerRegistryAuth } from '@oceanprotocol/lib'
// if customProviderUrl is set, we need to call provider using this custom endpoint
import { customProviderUrl } from '../../app.config.cjs'
import type { KeyValuePair } from 'src/@types/KeyValuePair'
import { Signer } from 'ethers'
import { toast } from 'react-toastify'
import { Service } from 'src/@types/ddo/Service'
import { AssetExtended } from 'src/@types/AssetExtended'
import { ResourceType } from 'src/@types/ResourceType'
import {
  PolicyServerInitiateActionData,
  PolicyServerInitiateComputeActionData
} from 'src/@types/PolicyServer'
import { resolveVerifierSessionId } from './verifierSession'
import {
  isBridgedV4Asset,
  getV4SourceDid,
  getV4ProviderUrl
} from './dualVersion'

const ENCRYPTED_PROVIDER_RESPONSE = /^0x[0-9a-fA-F]*$/

export type KnownStorageType =
  | 's3'
  | 'ipfs'
  | 'arweave'
  | 'url'
  | 'ftp'
  | 'smartcontract'
  | 'graphql'
  | 'hidden'
  | 'ftp'

export type StorageType = KnownStorageType | (string & unknown)

function normalizeProviderEncryptResponse(response: string): string {
  if (ENCRYPTED_PROVIDER_RESPONSE.test(response)) return response

  throw new Error(getErrorMessage(response))
}

export async function encryptProviderData(
  data: unknown,
  chainId: number,
  providerUrl: string,
  signer: Signer
): Promise<string> {
  const response = await ProviderInstance.encrypt(
    data,
    chainId,
    providerUrl,
    signer
  )
  return normalizeProviderEncryptResponse(response)
}

export async function initializeProviderForComputeMulti(
  datasets:
    | {
        asset: AssetExtended
        service: Service
        accessDetails: AccessDetails
        sessionId: string
      }[]
    | undefined,
  algorithm: AssetExtended,
  algoSessionId: string,
  accountId: Signer,
  computeEnv: ComputeEnvironment,
  selectedResources: ResourceType,
  svcIndexAlgo: number,
  paymentTokenAddress: string,
  computeOutput?: ComputeOutput,
  queueMaxWaitTime?: number,
  algoParams?: Record<string, any>,
  datasetParams?: Record<string, any>,
  dockerRegistryAuth?: DockerRegistryAuth
) {
  const safeDatasets = datasets ?? []
  const computeAssets = safeDatasets.map(
    ({ asset, service, accessDetails }) => ({
      documentId: asset.id,
      serviceId: service.id,
      transferTxId: accessDetails.validOrderTx,
      userdata: datasetParams
    })
  )

  const computeAlgo: ComputeAlgorithm = {
    documentId: algorithm.id,
    serviceId: algorithm.credentialSubject.services[svcIndexAlgo].id,
    transferTxId: algorithm.accessDetails[svcIndexAlgo].validOrderTx,
    userdata: algoParams
  }

  const policiesServer: PolicyServerInitiateComputeActionData[] = [
    ...safeDatasets.map(({ asset, service, sessionId }) => ({
      documentId: asset.id,
      serviceId: service.id,
      sessionId: resolveVerifierSessionId(asset.id, service.id, sessionId),
      successRedirectUri: '',
      errorRedirectUri: '',
      responseRedirectUri: '',
      presentationDefinitionUri: ''
    })),
    {
      documentId: algorithm.id,
      serviceId: algorithm.credentialSubject.services[svcIndexAlgo].id,
      sessionId: resolveVerifierSessionId(
        algorithm.id,
        algorithm.credentialSubject.services[svcIndexAlgo].id,
        algoSessionId
      ),
      successRedirectUri: '',
      errorRedirectUri: '',
      responseRedirectUri: '',
      presentationDefinitionUri: ''
    }
  ]

  const maxJobDuration = selectedResources.jobDuration * 60

  const providerUrl =
    safeDatasets[0]?.service.serviceEndpoint ||
    algorithm.credentialSubject.services[svcIndexAlgo].serviceEndpoint ||
    customProviderUrl

  // When the environment has no chain-specific fee config (fees: null), the
  // node stores it under chainId=0. Passing the asset's chainId to
  // initializeCompute would fail the node's env lookup — use 0 instead.
  const assetChainId =
    safeDatasets[0]?.asset.credentialSubject.chainId ??
    algorithm.credentialSubject.chainId
  const feesIsEmpty =
    !computeEnv.fees || Object.keys(computeEnv.fees).length === 0
  const chainId = !feesIsEmpty ? assetChainId : 0

  const resources =
    selectedResources.mode === 'free'
      ? computeEnv.free.resources.map((res) => ({
          id: res.id,
          amount: selectedResources?.[res.id] || res.max
        }))
      : computeEnv.resources.map((res) => ({
          id: res.id,
          amount: selectedResources?.[res.id] || res.min
        }))

  // When the compute environment has no fee configuration (fees: null/empty), the
  // node only registers it under chainId=0, but its own validate() rejects chainId=0.
  // For free compute mode there are no provider fees anyway, so we skip the broken
  // initializeCompute call and synthesise a zero-fee response. Ocean Protocol smart
  // contracts skip EIP-712 signature verification when providerFeeAmount = '0', so
  // the subsequent handleComputeOrder calls succeed without a real signed fee.
  if (selectedResources.mode === 'free' && feesIsEmpty) {
    console.log(
      '[initializeCompute] free env with null fees — bypassing initializeCompute'
    )
    const zeroFee: ProviderFees = {
      providerFeeAddress: ZERO_ADDRESS,
      providerFeeToken: ZERO_ADDRESS,
      providerFeeAmount: '0',
      providerData: '0x',
      v: '27',
      r: '0x0000000000000000000000000000000000000000000000000000000000000000',
      s: '0x0000000000000000000000000000000000000000000000000000000000000000',
      validUntil: '0'
    }
    return {
      datasets: safeDatasets.map(() => ({
        providerFee: zeroFee,
        validOrder: undefined
      })),
      algorithm: {
        providerFee: zeroFee,
        validOrder: undefined
      }
    } as ProviderComputeInitializeResults
  }

  console.log('[initializeCompute] request params', {
    computeEnvId: computeEnv.id,
    computeEnvFees: computeEnv.fees,
    paymentTokenAddress,
    chainId,
    providerUrl,
    resources,
    computeAssets,
    computeAlgo,
    maxJobDuration,
    mode: selectedResources.mode
  })

  return await ProviderInstance.initializeCompute(
    computeAssets,
    computeAlgo,
    computeEnv.id,
    paymentTokenAddress,
    maxJobDuration,
    providerUrl,
    await accountId.getAddress(),
    resources,
    chainId,
    policiesServer,
    null,
    queueMaxWaitTime,
    dockerRegistryAuth,
    computeOutput
  )
}

export async function getEncryptedFiles(
  files: any,
  chainId: number,
  providerUrl: string,
  signer: Signer
): Promise<string> {
  try {
    const filesForEncryption = {
      ...files,
      files: files.files.map((file: any) => {
        const cleanFile = { ...file }
        if (!cleanFile.type) cleanFile.type = 'url'
        return cleanFile
      })
    }
    const response = await encryptProviderData(
      filesForEncryption,
      chainId,
      providerUrl,
      signer
    )
    return response
  } catch (error) {
    const message = getErrorMessage(error.message)
    console.error('[getEncryptedFiles] Error:', {
      error,
      message,
      files: JSON.stringify(files),
      providerUrl,
      chainId
    })
    LoggerInstance.error('[Provider Encrypt] Error:', message)
    toast.error(message)
    throw error
  }
}

export async function getFileDidInfo(
  did: string,
  serviceId: string,
  providerUrl: string,
  withChecksum = false
): Promise<FileInfo[]> {
  try {
    const response = await ProviderInstance.checkDidFiles(
      did,
      serviceId,
      providerUrl,
      withChecksum
    )
    return response
  } catch (error) {
    const message = 'Failed to fetch file info from provider'
    LoggerInstance.warn('[Provider File Info] Request failed', {
      did,
      serviceId,
      error: error instanceof Error ? error.message : String(error)
    })
    throw new Error(`[Initialize check file did] Error: ${message}`)
  }
}

export async function getFileInfo(
  file: string,
  providerUrl: string,
  storageType: StorageType,
  query?: string,
  headers?: KeyValuePair[],
  abi?: string,
  chainId?: number,
  method?: string,
  s3Config?: S3FileObject,
  withChecksum = false
): Promise<FileInfo[]> {
  let response: FileInfo[] = []
  const headersProvider: { [key: string]: string } = {}
  if (headers?.length) {
    headers.forEach((el) => {
      headersProvider[el.key] = el.value
    })
  }

  switch (storageType) {
    case 'ipfs': {
      const fileIPFS: IpfsFileObject = {
        type: 'ipfs',
        hash: file
      }
      try {
        response = await ProviderInstance.getFileInfo(
          fileIPFS,
          providerUrl,
          withChecksum
        )
      } catch (error: any) {
        const message = getErrorMessage(error.message)
        LoggerInstance.error('[Provider Get File info] Error:', message)
        toast.error(message)
      }
      break
    }
    case 'arweave': {
      const fileArweave: ArweaveFileObject = {
        type: 'arweave',
        transactionId: file
      }
      try {
        response = await ProviderInstance.getFileInfo(
          fileArweave,
          providerUrl,
          withChecksum
        )
      } catch (error: any) {
        const message = getErrorMessage(error.message)
        LoggerInstance.error('[Provider Get File info] Error:', message)
        toast.error(message)
      }
      break
    }
    case 's3': {
      try {
        if (!s3Config) {
          throw new Error('S3 configuration is required for S3 file validation')
        }
        response = await ProviderInstance.getFileInfo(
          s3Config,
          providerUrl,
          withChecksum
        )
      } catch (error: any) {
        const message = getErrorMessage(error.message)
        LoggerInstance.error('[S3 File Validation] Error:', message)
        toast.error(message)
        throw error
      }
      break
    }
    case 'ftp': {
      const fileFtp: FtpFileObject = {
        type: 'ftp',
        url: file
      }
      try {
        response = await ProviderInstance.getFileInfo(
          fileFtp,
          providerUrl,
          withChecksum
        )
      } catch (error: any) {
        const message = getErrorMessage(error.message)
        LoggerInstance.error('[Provider Get File info] Error:', message)
        toast.error(message)
      }
      break
    }
    default: {
      const fileUrl: UrlFileObject = {
        type: storageType === 'url' ? 'url' : storageType,
        url: file,
        headers: headersProvider,
        method: method || 'get'
      } as UrlFileObject
      try {
        response = await ProviderInstance.getFileInfo(
          fileUrl,
          providerUrl,
          withChecksum
        )
      } catch (error: any) {
        const message = getErrorMessage(error.message)
        LoggerInstance.error('[Provider Get File info] Error:', message)
        toast.error(message)
      }
      break
    }
  }
  return response
}

export async function downloadFile(
  signer: Signer,
  asset: AssetExtended,
  service: Service,
  accessDetails: AccessDetails,
  accountId: string,
  verifierSessionId: string,
  validOrderTx?: string,
  userCustomParameters?: UserCustomParameters
) {
  let downloadUrl
  let fileName = `asset_${asset.id}.dat`

  const policyServer: PolicyServerInitiateActionData = {
    sessionId: verifierSessionId,
    successRedirectUri: ``,
    errorRedirectUri: ``,
    responseRedirectUri: ``,
    presentationDefinitionUri: ``
  }

  // Bridged v4 (e.g. Pontus-X) assets are consumed the plain v4 way: address the
  // provider by the DID it actually knows (did:op), hit the asset's REAL v4
  // provider (the bridge rewrote the visible endpoint), and no SSI/policyServer.
  const isV4 = isBridgedV4Asset(asset)
  const consumeDid = isV4 ? getV4SourceDid(asset) : asset.id
  const providerUrl = isV4
    ? getV4ProviderUrl(service)
    : service.serviceEndpoint || customProviderUrl
  const policyServerArg = isV4 ? undefined : policyServer

  try {
    downloadUrl = await ProviderInstance.getDownloadUrl(
      consumeDid,
      service.id,
      0,
      validOrderTx || accessDetails.validOrderTx,
      providerUrl,
      signer,
      policyServerArg,
      userCustomParameters
    )
    const fileInfo: any = await getFileDidInfo(
      consumeDid,
      service.id,
      providerUrl
    )
    const mimeExtensionMap: Record<string, string> = {
      'application/json': 'json',
      'application/vnd.api+json': 'json',
      'text/csv': 'csv',
      'application/pdf': 'pdf',
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'text/plain': 'txt',
      'application/octet-stream': 'bin'
    }

    if (Array.isArray(fileInfo) && fileInfo.length > 0) {
      const info = fileInfo[0]

      if (info.name) {
        fileName = info.name
      } else if (info.url) {
        fileName = info.url.split('/').pop() || fileName
      } else if (info.contentType) {
        const cleanContentType = info.contentType.split(';')[0].trim()
        const mappedExt = mimeExtensionMap[cleanContentType]

        if (mappedExt) {
          fileName = `asset_${asset.id}.${mappedExt}`
        } else {
          const guessed = cleanContentType.split('/').pop()
          fileName = `asset_${asset.id}.${guessed || 'dat'}`
        }
      }
    }

    fileName = fileName.replace(/[<>:"/\\|?*]+/g, '_')
  } catch (error) {
    const message = getErrorMessage(error.message)
    LoggerInstance.error('[Provider Get download url] Error:', message)
    toast.error(message)
    return
  }

  try {
    const response = await fetch(downloadUrl)
    if (!response.ok) {
      let providerMessage = ''

      try {
        providerMessage = await response.text()
      } catch {
        providerMessage = ''
      }

      const cleanProviderMessage = providerMessage?.trim()
      const statusText = response.statusText?.trim()
      const details =
        cleanProviderMessage ||
        statusText ||
        'Provider returned an empty error response.'

      console.error('[Download File Error]', {
        status: response.status,
        details,
        did: asset.id,
        serviceId: service.id,
        providerUrl: service.serviceEndpoint || customProviderUrl
      })

      throw new Error(`Download failed (${response.status}): ${details}`)
    }

    const blob = await response.blob()
    const blobUrl = window.URL.createObjectURL(blob)

    const link = document.createElement('a')
    link.href = blobUrl
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(blobUrl)
  } catch (error) {
    const message = getErrorMessage(error.message)
    LoggerInstance.error('[Download File Error]', message)
    toast.error(message)
  }
}

export async function checkValidProvider(
  providerUrl: string
): Promise<boolean> {
  try {
    const response = await ProviderInstance.isValidProvider(providerUrl)
    return response
  } catch (error) {
    const message = getErrorMessage(error.message)
    LoggerInstance.error('[Provider Check] Error:', message)
    toast.error(message)
  }
}

export async function getComputeEnvironments(
  providerUrl: string,
  chainId: number
): Promise<ComputeEnvironment[]> {
  try {
    const response = await ProviderInstance.getComputeEnvironments(providerUrl)
    const computeEnvs = Array.isArray(response) ? response : response[chainId]

    return computeEnvs
  } catch (error) {
    LoggerInstance.error(`[getComputeEnvironments] ${error.message}`)
  }
}
