from json import load, dump
import argparse
import sys
import traceback

config = {
	"current": "",
	"profiles": [],
	"meta_path": ""
}

parser = argparse.ArgumentParser(
                    prog = 'Aliyun profile creator',
                    description = 'What the program does',
                    epilog = 'Text at the bottom of help')

parser.add_argument('-i', '--input', default="tokens.json")
parser.add_argument('-o', '--output', default=".aliyun/config.json")
args = parser.parse_args()

finput = args.input
fouput = args.output

try:
    f = open(finput, 'r')
except OSError:
    print("Could not open/read file:", finput)
    traceback.print_exc(file=sys.stdout)
    sys.exit()

with f:
    tokens = load(f)

try:
    fconf = open(fouput, 'w')
except OSError:
    print("Could not open/write file:", fouput)
    traceback.print_exc(file=sys.stdout)
    sys.exit()



for token in tokens:
	profile = {
	"name": f"{token['name']}",
	"mode": "StsToken",
	"access_key_id": f"{token['data']['access_key_id']}",
	"access_key_secret": f"{token['data']['access_key_secret']}",
	"sts_token": f"{token['data']['sts_token']}",
	"sts_region": "",
	"ram_role_name": "",
	"ram_role_arn": "",
	"ram_session_name": "",
	"source_profile": "",
	"private_key": "",
	"key_pair_name": "",
	"expired_seconds": 0,
	"verified": "",
	"region_id": "cn-hangzhou",
	"output_format": "json",
	"language": "en",
	"site": "",
	"retry_timeout": 0,
	"connect_timeout": 0,
	"retry_count": 0,
	"process_command": "",
	"credentials_uri": ""
	}
	config['profiles'].append(profile)
	
	if not config['current']:
		config['current'] = token['name']

with fconf:
	dump(config, fconf)


