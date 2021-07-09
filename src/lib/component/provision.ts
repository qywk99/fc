import * as core from '@serverless-devs/core';
import fs from 'fs';
import logger from '../../common/logger';
import * as help_constant from '../help/provision';
import Client from '../client';
import { tableShow } from '../utils';

interface IProps {
  region?: string;
  serviceName?: string;
  qualifier?: string;
  functionName?: string;
  config?: string;
  target?: number;
}

const PROVISION_COMMADN: string[] = ['list', 'get', 'put'];

export default class Provision {
  static async handlerInputs(inputs) {
    logger.debug(`inputs.props: ${JSON.stringify(inputs.props)}`);

    const parsedArgs: {[key: string]: any} = core.commandParse(inputs, {
      boolean: ['help', 'table'],
      string: ['region', 'service-name', 'qualifier', 'function-name', 'config'],
      number: ['target'],
      alias: { help: 'h' },
    });

    const parsedData = parsedArgs?.data || {};
    const rawData = parsedData._ || [];
    if (!rawData.length) {
      core.help(help_constant.PROVISION);
      process.exit();
    }

    const subCommand = rawData[0];
    logger.debug(`provision subCommand: ${subCommand}`);
    if (!PROVISION_COMMADN.includes(subCommand)) {
      core.help(help_constant.PROVISION);
      return { errorMessage: `Does not support ${subCommand} command` };
    }
    if (parsedData.help) {
      core.help(help_constant[`provision_${subCommand}`.toLocaleUpperCase()]);
      return { help: true, subCommand };
    }

    const props = inputs.props || {};
    const region = parsedData.region || props.region;
    if (!region) {
      throw new Error('Not fount region');
    }
    const endProps: IProps = {
      region,
      serviceName: parsedData['service-name'] || props.service?.name,
      qualifier: parsedData.qualifier || props.qualifier,
      functionName: parsedData['function-name'] || props.function?.name,
      config: parsedData.config,
      target: parsedData.target,
    };

    const credentials = inputs.credentials || await core.getCredential(inputs.project.access);
    logger.debug(`handler inputs props: ${JSON.stringify(endProps)}`);

    return {
      credentials,
      subCommand,
      props: endProps,
      table: parsedData.table,
    };
  }

  constructor({ region, credentials }) {
    Client.setFcClient(region, credentials);
  }

  async get({ serviceName, qualifier, functionName }) {
    if (!functionName) {
      throw new Error('Not fount functionName');
    }
    if (!qualifier) {
      throw new Error('Not fount qualifier');
    }
    if (!serviceName) {
      throw new Error('Not fount serviceName');
    }
    logger.info(`Getting provision: ${serviceName}.${qualifier}/${functionName}`);
    const { data } = await Client.fcClient.getProvisionConfig(serviceName, functionName, qualifier);
    if (data) {
      return {
        serviceName,
        functionName,
        qualifier,
        ...data,
      };
    }
  }

  async put({ serviceName, qualifier, functionName, config, target }) {
    if (!functionName) {
      throw new Error('Not fount functionName parameter');
    }
    if (!qualifier) {
      throw new Error('Not fount qualifier parameter');
    }
    if (!serviceName) {
      throw new Error('Not fount serviceName parameter');
    }
    if (!config && typeof target !== 'number') {
      throw new Error('config and target must fill in one');
    }

    let options: any = {
      target: 0,
      scheduledActions: [],
      targetTrackingPolicies: [],
    };
    if (config) {
      try {
        const fileStr = fs.readFileSync(config, 'utf8');
        options = JSON.parse(fileStr);
      } catch (ex) {
        logger.debug(`Read ${config} error: ${ex.message}`);
        throw new Error(`Reading ${config} file failed, please check whether this file exists and is a standard JSON`);
      }
    }
    if (typeof target === 'number') {
      options.target = target;
    }

    logger.info(`Updating provision: ${serviceName}.${qualifier}/${functionName}`);
    const { data } = await Client.fcClient.putProvisionConfig(serviceName, functionName, qualifier, options);
    return data;
  }

  async list({ serviceName, qualifier }: IProps, table?) {
    logger.info(`Getting list provision: ${serviceName}`);
    const data = await Client.fcClient.get_all_list_data('/provision-configs', 'provisionConfigs', {
      serviceName,
      qualifier,
    });
    if (table) {
      tableShow(data, [
        { value: 'resource', width: '10%', alias: 'serviceName', formatter: (value) => value.split('#')[1] },
        { value: 'resource', width: '10%', alias: 'qualifier', formatter: (value) => value.split('#')[2] },
        { value: 'resource', width: '10%', alias: 'functionName', formatter: (value) => value.split('#')[3] },
        { value: 'target', width: '10%', alias: 'target', formatter: (value) => value || '0' },
        { value: 'current', width: '10%', alias: 'current', formatter: (value) => value || '0' },
        {
          value: 'scheduledActions',
          width: '25%',
          formatter: (value) => (value && value.length ? JSON.stringify(value, null, 2) : value),
        },
        {
          value: 'targetTrackingPolicies',
          width: '25%',
          formatter: (value) => (value && value.length ? JSON.stringify(value, null, 2) : value),
        },
      ]);
    } else {
      return data;
    }
  }
}
