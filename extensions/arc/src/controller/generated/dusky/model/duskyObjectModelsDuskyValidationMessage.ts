/**
 * Dusky API
 * No description provided (generated by Openapi Generator https://github.com/openapitools/openapi-generator)
 *
 * The version of the OpenAPI document: v1
 *
 *
 * NOTE: This class is auto generated by OpenAPI Generator (https://openapi-generator.tech).
 * https://openapi-generator.tech
 * Do not edit the class manually.
 */


export class DuskyObjectModelsDuskyValidationMessage {
    'type'?: DuskyObjectModelsDuskyValidationMessage.TypeEnum;
    'code'?: DuskyObjectModelsDuskyValidationMessage.CodeEnum;
    'message'?: string;

    static discriminator: string | undefined = undefined;

    static attributeTypeMap: Array<{name: string, baseName: string, type: string}> = [
        {
            "name": "type",
            "baseName": "type",
            "type": "DuskyObjectModelsDuskyValidationMessage.TypeEnum"
        },
        {
            "name": "code",
            "baseName": "code",
            "type": "DuskyObjectModelsDuskyValidationMessage.CodeEnum"
        },
        {
            "name": "message",
            "baseName": "message",
            "type": "string"
        }    ];

    static getAttributeTypeMap() {
        return DuskyObjectModelsDuskyValidationMessage.attributeTypeMap;
    }
}

export namespace DuskyObjectModelsDuskyValidationMessage {
    export enum TypeEnum {
        Info = <any> 'Info',
        Warning = <any> 'Warning',
        Fail = <any> 'Fail'
    }
    export enum CodeEnum {
        InvalidInput = <any> 'InvalidInput',
        ResourceExists = <any> 'ResourceExists',
        ResourceNotFound = <any> 'ResourceNotFound',
        ResourceNotRunning = <any> 'ResourceNotRunning',
        AvailableResources = <any> 'AvailableResources',
        InsufficientResources = <any> 'InsufficientResources'
    }
}
